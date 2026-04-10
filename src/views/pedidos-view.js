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

    for (const pedido of pedidos) {
      const disabled = pedido.status !== "pendente" ? "disabled" : "";
      this.tableBody.appendChild(
        createRow(`
          <td>${pedido.id}</td>
          <td>${pedido.status}</td>
          <td>${pedido.farmacia_id}</td>
          <td>${pedido.prioridade ?? "-"}</td>
          <td><button class="danger-btn" ${disabled} data-action="cancelar-pedido" data-id="${pedido.id}">Cancelar</button></td>
        `)
      );
    }
  }
}
