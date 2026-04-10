import { BasePageController } from "./base-page-controller.js";

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
      const button = event.target.closest("button[data-action='cancelar-pedido']");
      if (!button) {
        return;
      }

      try {
        await this.model.cancelarPedido(button.dataset.id);
        this.shellView.addAlert(`Pedido ${button.dataset.id} cancelado.`, "ok");
        await this.loadPedidos();
      } catch (error) {
        this.handleError("Falha ao cancelar pedido", error);
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
