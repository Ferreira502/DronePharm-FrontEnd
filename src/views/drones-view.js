function createRow(html) {
  const row = document.createElement("tr");
  row.innerHTML = html;
  return row;
}

export class DronesView {
  constructor() {
    this.form = document.getElementById("drone-form");
    this.tableBody = document.getElementById("drones-body");
  }

  resetForm() {
    this.form?.reset();
  }

  renderDrones(drones = []) {
    this.tableBody.innerHTML = "";

    for (const drone of drones) {
      this.tableBody.appendChild(
        createRow(`
          <td>${drone.id}</td>
          <td>${drone.nome}</td>
          <td>${drone.status}</td>
          <td>${drone.bateria_pct ?? "-"}</td>
          <td><button class="danger-btn" data-action="desativar-drone" data-id="${drone.id}">Desativar</button></td>
        `)
      );
    }
  }
}
