import { BasePageController } from "./base-page-controller.js";
import { subscribeOrderChanged } from "../services/order-sync.js";
import { enhanceSnapshotWithLifecycle } from "../services/order-lifecycle.js";

export class MapController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
    this.mapView = deps.mapView;
    this.lastSnapshot = null;
  }

  async init() {
    await this.initializeShell();
    this.bindEvents();
    this.startRealtime();
    await this.refresh();
    this.startLifecycleTicker();
  }

  bindEvents() {
    this.view.refreshButton.addEventListener("click", async () => {
      await this.refresh();
      this.shellView.addAlert("Mapa atualizado manualmente.", "ok");
    });

    this.unsubscribeOrderChanged = subscribeOrderChanged(async () => {
      await this.refresh();
      this.shellView.addAlert("Mapa sincronizado com atualizacao de pedido.", "ok");
    });
  }

  startRealtime() {
    this.startAlertSocket();
    this.socketService.open(this.model.endpoints.wsTelemetria, {
      onMessage: async (payload) => {
        if (payload.tipo !== "telemetria") {
          return;
        }

        const bateria = Number(payload.bateria_pct ?? 0);
        this.shellView.addAlert(
          `Telemetria ${payload.drone_id}: bateria ${(bateria * 100).toFixed(1)}%, vento ${payload.vento_ms} m/s`,
          "info"
        );
        await this.refresh();
      },
    });
  }

  startLifecycleTicker() {
    this.lifecycleTimer = window.setInterval(() => {
      if (!this.lastSnapshot) {
        return;
      }

      this.mapView.drawSnapshot(enhanceSnapshotWithLifecycle(this.lastSnapshot));
    }, 1000);
  }

  async refresh() {
    try {
      const [snapshot, frota] = await Promise.all([
        this.model.fetchSnapshot(),
        this.model.fetchFrotaStatus(),
      ]);

      this.lastSnapshot = snapshot;
      this.mapView.drawSnapshot(enhanceSnapshotWithLifecycle(snapshot));
      this.view.renderFrotaKpis(frota.resumo || {});
      this.view.renderDroneCards(frota.drones || []);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar mapa interativo", error);
    }
  }
}
