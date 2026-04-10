function createRow(html) {
  const row = document.createElement("tr");
  row.innerHTML = html;
  return row;
}

export class FarmaciasView {
  constructor() {
    this.form = document.getElementById("farmacia-form");
    this.tableBody = document.getElementById("farmacias-body");
  }

  resetForm() {
    this.form?.reset();
  }

  renderFarmacias(farmacias = []) {
    this.tableBody.innerHTML = "";

    for (const farmacia of farmacias) {
      const disabled = farmacia.deposito ? "disabled" : "";
      const label = farmacia.deposito ? "Deposito" : "Excluir";

      this.tableBody.appendChild(
        createRow(`
          <td>${farmacia.id}</td>
          <td>${farmacia.nome}</td>
          <td>${farmacia.cidade || "-"}</td>
          <td>${farmacia.deposito ? "Sim" : "Nao"}</td>
          <td><button class="danger-btn" ${disabled} data-action="desativar-farmacia" data-id="${farmacia.id}">${label}</button></td>
        `)
      );
    }
  }
}
