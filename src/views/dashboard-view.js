function clearChildren(element) {
  if (element) {
    element.innerHTML = "";
  }
}

function createRow(html) {
  const row = document.createElement("tr");
  row.innerHTML = html;
  return row;
}

export class DashboardView {
  constructor() {
    this.els = {
      backendLabel: document.getElementById("backend-label"),
      connectionPill: document.getElementById("connection-pill"),
      alertsList: document.getElementById("alerts-list"),
      droneList: document.getElementById("drone-list"),
      pedidoForm: document.getElementById("pedido-form"),
      farmaciaForm: document.getElementById("farmacia-form"),
      droneForm: document.getElementById("drone-form"),
      refreshMapBtn: document.getElementById("refresh-map-btn"),
      refreshGestaoBtn: document.getElementById("refresh-gestao-btn"),
      exportBtn: document.getElementById("export-report-btn"),
      dronesBody: document.getElementById("drones-body"),
      farmaciasBody: document.getElementById("farmacias-body"),
      pedidosBody: document.getElementById("pedidos-body"),
      historicoBody: document.getElementById("historico-body"),
      farmaciaIdInput: document.querySelector("input[name='farmacia_id']"),
      kpi: {
        totalDrones: document.getElementById("kpi-total-drones"),
        emVoo: document.getElementById("kpi-em-voo"),
        alertaBateria: document.getElementById("kpi-alerta-bateria"),
        entregas: document.getElementById("kpi-entregas"),
        pontualidade: document.getElementById("kpi-pontualidade"),
        tempoMedio: document.getElementById("kpi-tempo-medio"),
        pesoTotal: document.getElementById("kpi-peso-total"),
      },
    };
  }

  setBackendLabel(label) {
    this.els.backendLabel.textContent = label;
  }

  setConnection(status, label) {
    this.els.connectionPill.textContent = label;
    this.els.connectionPill.className = `pill ${status}`;
  }

  addAlert(message, severity = "info") {
    const item = document.createElement("li");
    item.className = `alert-${severity}`;
    item.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> | ${message}`;
    this.els.alertsList.prepend(item);

    while (this.els.alertsList.children.length > 12) {
      this.els.alertsList.removeChild(this.els.alertsList.lastChild);
    }
  }

  suggestFarmaciaId(farmacias = []) {
    const first = farmacias[0];
    if (!first || !this.els.farmaciaIdInput) {
      return;
    }

    if (!this.els.farmaciaIdInput.value || Number(this.els.farmaciaIdInput.value) <= 0) {
      this.els.farmaciaIdInput.value = String(first.id);
    }
  }

  renderDroneCards(drones = []) {
    clearChildren(this.els.droneList);

    for (const drone of drones) {
      const article = document.createElement("article");
      article.className = "drone-item";
      article.innerHTML = `
        <div class="title">${drone.nome || drone.id} | ${drone.status || "-"}</div>
        <div class="meta">Bateria: ${drone.bateria_pct ?? "-"}% | Missoes: ${drone.missoes_realizadas ?? "-"}</div>
        <div class="meta">GPS: ${drone.latitude_atual ?? "-"}, ${drone.longitude_atual ?? "-"}</div>
      `;
      this.els.droneList.appendChild(article);
    }
  }

  renderHistorico(rows = []) {
    clearChildren(this.els.historicoBody);

    for (const row of rows) {
      this.els.historicoBody.appendChild(
        createRow(`
          <td>#${row.pedido_id}</td>
          <td>${row.drone_id}</td>
          <td>${row.farmacia_id}</td>
          <td>${row.tempo_real_min ?? "-"}</td>
          <td>${row.distancia_km ?? "-"}</td>
          <td>${row.entregue_no_prazo ? "Sim" : "Nao"}</td>
        `)
      );
    }
  }

  renderGestaoDrones(drones = []) {
    clearChildren(this.els.dronesBody);

    for (const drone of drones) {
      this.els.dronesBody.appendChild(
        createRow(`
          <td>${drone.id}</td>
          <td>${drone.nome}</td>
          <td>${drone.status}</td>
          <td><button class="danger-btn" data-action="desativar-drone" data-id="${drone.id}">Desativar</button></td>
        `)
      );
    }
  }

  renderGestaoFarmacias(farmacias = []) {
    clearChildren(this.els.farmaciasBody);

    for (const farmacia of farmacias) {
      const disabled = farmacia.deposito ? "disabled" : "";
      const label = farmacia.deposito ? "Deposito" : "Excluir";

      this.els.farmaciasBody.appendChild(
        createRow(`
          <td>${farmacia.id}</td>
          <td>${farmacia.nome}</td>
          <td>${farmacia.deposito ? "Sim" : "Nao"}</td>
          <td><button class="danger-btn" ${disabled} data-action="desativar-farmacia" data-id="${farmacia.id}">${label}</button></td>
        `)
      );
    }
  }

  renderGestaoPedidos(pedidos = []) {
    clearChildren(this.els.pedidosBody);

    for (const pedido of pedidos.filter((item) => item.status !== "cancelado")) {
      const disabled = pedido.status !== "pendente" ? "disabled" : "";

      this.els.pedidosBody.appendChild(
        createRow(`
          <td>${pedido.id}</td>
          <td>${pedido.status}</td>
          <td>${pedido.farmacia_id}</td>
          <td><button class="danger-btn" ${disabled} data-action="cancelar-pedido" data-id="${pedido.id}">Cancelar</button></td>
        `)
      );
    }
  }

  renderFrotaKpis(resumo = {}) {
    this.els.kpi.totalDrones.textContent = resumo.total ?? 0;
    this.els.kpi.emVoo.textContent = resumo.em_voo ?? 0;
    this.els.kpi.alertaBateria.textContent = resumo.alerta_bateria ?? 0;
  }

  renderReportKpis(kpi = {}) {
    this.els.kpi.entregas.textContent = kpi.total_entregas ?? 0;
    this.els.kpi.pontualidade.textContent = `${Number(kpi.taxa_pontualidade_pct ?? 0).toFixed(1)}%`;
    this.els.kpi.tempoMedio.textContent = `${Number(kpi.tempo_medio_min ?? 0).toFixed(1)} min`;
    this.els.kpi.pesoTotal.textContent = `${Number(kpi.peso_total_entregue_kg ?? 0).toFixed(2)} kg`;
  }

  resetForm(form) {
    if (form && typeof form.reset === "function") {
      form.reset();
    }
  }

  downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
