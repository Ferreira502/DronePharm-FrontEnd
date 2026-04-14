import { BasePageController } from "./base-page-controller.js";
import { notifyOrderChanged } from "../services/order-sync.js";

export class PedidosController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
  }

  async init() {
    await this.initializeShell();
    this.startAlertSocket();
    this.bindEvents();
    await this.loadFarmacias();
    await this.loadPedidos();
  }

  bindEvents() {
    this.view.form.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await this.model.createPedido(new FormData(this.view.form));
        this.view.resetForm();
        this.shellView.addAlert("Pedido cadastrado com sucesso.", "ok");
        await this.loadPedidos();
      } catch (error) {
        this.handleError("Falha ao cadastrar pedido", error);
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const { action, id } = button.dataset;
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Processando...";

      try {
        if (action === "cancelar-pedido") {
          await this.model.cancelarPedido(id);
          this.shellView.addAlert(`Pedido ${id} cancelado.`, "ok");
          notifyOrderChanged({ id, action: "cancelado" });
        }

        if (action === "entregar-pedido") {
          await this.model.marcarPedidoEntregue(id);
          this.shellView.addAlert(`Pedido ${id} marcado como entregue.`, "ok");
          notifyOrderChanged({ id, action: "entregue" });
        }

        await this.loadPedidos();
      } catch (error) {
        if (error.status === 409) {
          const message =
            action === "cancelar-pedido"
              ? `Pedido ${id} nao pode ser cancelado no status atual.`
              : `Pedido ${id} nao pode ser marcado como entregue no status atual.`;
          this.shellView.addAlert(message, "warn");
          await this.loadPedidos();
        } else {
          const prefix =
            action === "cancelar-pedido"
              ? "Falha ao cancelar pedido"
              : "Falha ao marcar pedido como entregue";
          this.handleError(prefix, error);
        }
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
  }

  async loadFarmacias() {
    try {
      const payload = await this.model.fetchFarmacias();
      const farmacias = payload.farmacias || [];
      this.view.suggestFarmaciaId(farmacias);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar farmacias", error);
    }
  }

  async loadPedidos() {
    try {
      const payload = await this.model.fetchPedidos(50);
      this.view.renderPedidos(payload.pedidos || []);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar pedidos", error);
    }
  }
}
