import { BasePageController } from "./base-page-controller.js";

export class FarmaciasController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
  }

  async init() {
    await this.initializeShell();
    this.startAlertSocket();
    this.bindEvents();
    await this.loadFarmacias();
  }

  bindEvents() {
    this.view.form.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await this.model.createFarmacia(new FormData(this.view.form));
        this.view.resetForm();
        this.shellView.addAlert("Farmacia cadastrada com sucesso.", "ok");
        await this.loadFarmacias();
      } catch (error) {
        this.handleError("Falha ao cadastrar farmacia", error);
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='desativar-farmacia']");
      if (!button) {
        return;
      }

      try {
        await this.model.desativarFarmacia(button.dataset.id);
        this.shellView.addAlert(`Farmacia ${button.dataset.id} removida.`, "ok");
        await this.loadFarmacias();
      } catch (error) {
        this.handleError("Falha ao remover farmacia", error);
      }
    });
  }

  async loadFarmacias() {
    try {
      const payload = await this.model.fetchFarmacias();
      this.view.renderFarmacias(payload.farmacias || []);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar farmacias", error);
    }
  }
}
