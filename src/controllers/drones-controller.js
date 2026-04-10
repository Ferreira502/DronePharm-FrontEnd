import { BasePageController } from "./base-page-controller.js";

export class DronesController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
  }

  async init() {
    await this.initializeShell();
    this.startAlertSocket();
    this.bindEvents();
    await this.loadDrones();
  }

  bindEvents() {
    this.view.form.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await this.model.createDrone(new FormData(this.view.form));
        this.view.resetForm();
        this.shellView.addAlert("Drone cadastrado com sucesso.", "ok");
        await this.loadDrones();
      } catch (error) {
        this.handleError("Falha ao cadastrar drone", error);
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='desativar-drone']");
      if (!button) {
        return;
      }

      try {
        await this.model.desativarDrone(button.dataset.id);
        this.shellView.addAlert(`Drone ${button.dataset.id} movido para manutencao.`, "ok");
        await this.loadDrones();
      } catch (error) {
        this.handleError("Falha ao desativar drone", error);
      }
    });
  }

  async loadDrones() {
    try {
      const payload = await this.model.fetchDrones();
      this.view.renderDrones(payload.drones || []);
      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar drones", error);
    }
  }
}
