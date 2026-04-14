function createRow(html) {
  const row = document.createElement("tr");
  row.innerHTML = html;
  return row;
}

export class OperationsView {
  constructor() {
    this.historicoBody = document.getElementById("historico-body");
    this.pedidosBody = document.getElementById("operacoes-pedidos-body");
    this.exportBtn = document.getElementById("export-report-btn");
    this.kpis = {
      entregas: document.getElementById("kpi-entregas"),
      pontualidade: document.getElementById("kpi-pontualidade"),
      tempoMedio: document.getElementById("kpi-tempo-medio"),
      pesoTotal: document.getElementById("kpi-peso-total"),
    };
  }

  renderHistorico(rows = []) {
    this.historicoBody.innerHTML = "";

    for (const row of rows) {
      this.historicoBody.appendChild(
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

  renderPedidos(pedidos = []) {
    this.pedidosBody.innerHTML = "";

    for (const pedido of pedidos.filter((item) => item.status !== "cancelado")) {
      const disabled = !["pendente", "calculado"].includes(String(pedido.status || "").toLowerCase()) ? "disabled" : "";
      this.pedidosBody.appendChild(
        createRow(`
          <td>${pedido.id}</td>
          <td>${pedido.status}</td>
          <td>${pedido.drone_id || "-"}</td>
          <td>${pedido.farmacia_id}</td>
          <td>${pedido.prioridade ?? "-"}</td>
          <td><button class="danger-btn" ${disabled} data-action="cancelar-pedido" data-id="${pedido.id}">Cancelar</button></td>
        `)
      );
    }
  }

  renderKpis(kpi = {}) {
    this.kpis.entregas.textContent = kpi.total_entregas ?? 0;
    this.kpis.pontualidade.textContent = `${Number(kpi.taxa_pontualidade_pct ?? 0).toFixed(1)}%`;
    this.kpis.tempoMedio.textContent = `${Number(kpi.tempo_medio_min ?? 0).toFixed(1)} min`;
    this.kpis.pesoTotal.textContent = `${Number(kpi.peso_total_entregue_kg ?? 0).toFixed(2)} kg`;
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
