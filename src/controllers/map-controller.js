import { BasePageController } from "./base-page-controller.js";
import { subscribeOrderChanged } from "../services/order-sync.js";
import { enhanceSnapshotWithLifecycle } from "../services/order-lifecycle.js";

export class MapController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
    this.mapView = deps.mapView;
    this.lastSnapshot = null;
    this.refreshInFlight = null;
    this.refreshQueued = false;
    this.telemetryRefreshTimer = null;
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
      await this.refresh({ fitBounds: true });
      this.shellView.addAlert("Mapa atualizado manualmente.", "ok");
    });

    this.unsubscribeOrderChanged = subscribeOrderChanged(async () => {
      await this.refresh({ fitBounds: false });
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
        this.scheduleTelemetryRefresh();
      },
    });
  }

  scheduleTelemetryRefresh() {
    if (this.telemetryRefreshTimer) {
      return;
    }

    this.telemetryRefreshTimer = window.setTimeout(async () => {
      this.telemetryRefreshTimer = null;
      await this.refresh({ fitBounds: false });
    }, 1500);
  }

  startLifecycleTicker() {
    this.lifecycleTimer = window.setInterval(() => {
      if (!this.lastSnapshot) {
        return;
      }

      this.mapView.drawSnapshot(enhanceSnapshotWithLifecycle(this.lastSnapshot), {
        fitBounds: false,
        animateRoutes: false,
      });
    }, 1000);
  }

  async refresh({ fitBounds = true } = {}) {
    if (this.refreshInFlight) {
      this.refreshQueued = true;
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.performRefresh({ fitBounds });

    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;

      if (this.refreshQueued) {
        this.refreshQueued = false;
        return this.refresh({ fitBounds: false });
      }
    }
  }

  async performRefresh({ fitBounds = true } = {}) {
    try {
      const [snapshot, frota] = await Promise.all([
        this.model.fetchSnapshot(),
        this.model.fetchFrotaStatus(),
      ]);

      this.lastSnapshot = snapshot;
      this.mapView.drawSnapshot(enhanceSnapshotWithLifecycle(snapshot), {
        fitBounds,
        animateRoutes: true,
      });
      this.view.renderFrotaKpis(frota.resumo || {});
      this.view.renderDroneCards(frota.drones || []);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar mapa interativo", error);
    }
  }
}
