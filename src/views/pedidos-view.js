function createRow(html) {
  const row = document.createElement("tr");
  row.innerHTML = html;
  return row;
}

export class PedidosView {
  constructor() {
    this.form = document.getElementById("pedido-form");
    this.tableBody = document.getElementById("pedidos-body");
    this.farmaciaIdInput = document.querySelector("input[name='farmacia_id']");
  }

  suggestFarmaciaId(farmacias = []) {
    const first = farmacias[0];
    if (!first || !this.farmaciaIdInput) {
      return;
    }

    if (!this.farmaciaIdInput.value || Number(this.farmaciaIdInput.value) <= 0) {
      this.farmaciaIdInput.value = String(first.id);
    }
  }

  resetForm() {
    this.form?.reset();
  }

  renderPedidos(pedidos = []) {
    this.tableBody.innerHTML = "";

    const visiblePedidos = pedidos.filter((pedido) => {
      const normalizedStatus = String(pedido.status || "").toLowerCase();
      return !["entregue", "cancelado", "falha"].includes(normalizedStatus);
    });

    for (const pedido of visiblePedidos) {
      const normalizedStatus = String(pedido.status || "").toLowerCase();
      const canCancel = ["pendente", "calculado"].includes(normalizedStatus);
      const canDeliver = !["entregue", "cancelado", "falha"].includes(normalizedStatus);
      this.tableBody.appendChild(
        createRow(`
          <td>${pedido.id}</td>
          <td>${pedido.status}</td>
          <td>${pedido.drone_id || "-"}</td>
          <td>${pedido.farmacia_id}</td>
          <td>${pedido.prioridade ?? "-"}</td>
          <td>${pedido.elapsed_label || "-"}</td>
          <td>${pedido.eta_label || "-"}</td>
          <td>${pedido.descricao || "-"}</td>
          <td>
            <div class="action-group">
              <button class="secondary action-btn" ${canDeliver ? "" : "disabled"} data-action="entregar-pedido" data-id="${pedido.id}">Entregue</button>
              <button class="danger-btn action-btn" ${canCancel ? "" : "disabled"} data-action="cancelar-pedido" data-id="${pedido.id}">Cancelar</button>
            </div>
          </td>
        `)
      );
    }
  }
}
