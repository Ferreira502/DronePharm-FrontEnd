export class HomeView {
  constructor() {
    this.cards = {
      drones: document.getElementById("overview-drones"),
      emVoo: document.getElementById("overview-em-voo"),
      farmacias: document.getElementById("overview-farmacias"),
      pedidos: document.getElementById("overview-pedidos"),
      entregas: document.getElementById("overview-entregas"),
      pontualidade: document.getElementById("overview-pontualidade"),
    };
  }

  renderSummary({ frota = {}, farmacias = [], pedidos = [], kpis = {} }) {
    this.cards.drones.textContent = frota.resumo?.total ?? 0;
    this.cards.emVoo.textContent = frota.resumo?.em_voo ?? 0;
    this.cards.farmacias.textContent = farmacias.length;
    this.cards.pedidos.textContent = pedidos.filter((item) => item.status !== "cancelado").length;
    this.cards.entregas.textContent = kpis.total_entregas ?? 0;
    this.cards.pontualidade.textContent = `${Number(kpis.taxa_pontualidade_pct ?? 0).toFixed(1)}%`;
  }
}
