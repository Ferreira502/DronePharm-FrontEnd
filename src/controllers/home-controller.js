import { BasePageController } from "./base-page-controller.js";

export class HomeController extends BasePageController {
  constructor(deps) {
    super(deps);
    this.view = deps.view;
  }

  async init() {
    await this.initializeShell();
    this.startAlertSocket();
    await this.refresh();
  }

  async refresh() {
    try {
      const [frota, farmacias, pedidos, kpis] = await Promise.all([
        this.model.fetchFrotaStatus(),
        this.model.fetchFarmacias(),
        this.model.fetchPedidos(20),
        this.model.fetchKpis(),
      ]);

      this.view.renderSummary({
        frota,
        farmacias: farmacias.farmacias || [],
        pedidos: pedidos.pedidos || [],
        kpis,
      });

      this.markSynced();
    } catch (error) {
      this.handleError("Falha ao carregar resumo executivo", error);
    }
  }
}
