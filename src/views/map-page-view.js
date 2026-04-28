export class MapPageView {
  constructor() {
    this.refreshButton = document.getElementById("refresh-map-btn");
    this.droneList = document.getElementById("drone-list");
    this.kpis = {
      totalDrones: document.getElementById("kpi-total-drones"),
      emVoo: document.getElementById("kpi-em-voo"),
      alertaBateria: document.getElementById("kpi-alerta-bateria"),
    };
  }

  renderDroneCards(drones = []) {
    this.droneList.innerHTML = "";

    for (const drone of drones) {
      const article = document.createElement("article");
      article.className = "drone-item";
      article.innerHTML = `
        <div class="title">${drone.nome || drone.id} | ${drone.status || "-"}</div>
        <div class="meta">Bateria: ${drone.bateria_pct ?? "-"}% | Missoes: ${drone.missoes_realizadas ?? "-"}</div>
        <div class="meta">GPS: ${drone.latitude_atual ?? "-"}, ${drone.longitude_atual ?? "-"}</div>
      `;
      this.droneList.appendChild(article);
    }
  }

  renderFrotaKpis(resumo = {}) {
    this.kpis.totalDrones.textContent = resumo.total ?? 0;
    this.kpis.emVoo.textContent = resumo.em_voo ?? 0;
    this.kpis.alertaBateria.textContent = resumo.alerta_bateria ?? 0;
  }
}
