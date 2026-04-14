import { BasePageController } from "./base-page-controller.js";
import { notifyOrderChanged } from "../services/order-sync.js";
import { markOrderAsCancelled, syncOrdersWithLifecycle } from "../services/order-lifecycle.js";

export class OperationsController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
  }

  async init() {
    await this.initializeShell();
    this.startAlertSocket();
    this.bindEvents();
    await this.refresh();
  }

  bindEvents() {
    this.view.exportBtn.addEventListener("click", async () => {
      try {
        const [historico, kpis, pedidos] = await Promise.all([
          this.model.fetchHistorico(50),
          this.model.fetchKpis(),
          this.model.fetchPedidos(50),
        ]);

        this.view.downloadJson("dronepharm-operacoes.json", {
          historico,
          kpis,
          pedidos,
          exported_at: new Date().toISOString(),
        });

        this.shellView.addAlert("Relatorio operacional exportado.", "ok");
      } catch (error) {
        this.handleError("Falha ao exportar relatorio", error);
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='cancelar-pedido']");
      if (!button) {
        return;
      }

      try {
        await this.model.cancelarPedido(button.dataset.id);
        markOrderAsCancelled(button.dataset.id);
        this.shellView.addAlert(`Pedido ${button.dataset.id} cancelado.`, "ok");
        notifyOrderChanged({ id: button.dataset.id, action: "cancelado" });
        await this.refresh();
      } catch (error) {
        this.handleError("Falha ao cancelar pedido", error);
      }
    });
  }

  async refresh() {
    try {
      const [historico, kpis, pedidos] = await Promise.all([
        this.model.fetchHistorico(30),
        this.model.fetchKpis(),
        this.model.fetchPedidos(30),
      ]);

      this.view.renderHistorico(historico.historico || []);
      this.view.renderPedidos(syncOrdersWithLifecycle(pedidos.pedidos || []));
      this.view.renderKpis(kpis);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar operacoes", error);
    }
  }
}
