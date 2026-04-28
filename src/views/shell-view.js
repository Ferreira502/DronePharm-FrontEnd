export class ShellView {
  constructor() {
    this.backendLabel = document.getElementById("backend-label");
    this.connectionPill = document.getElementById("connection-pill");
    this.alertsList = document.getElementById("alerts-list");
    this.lastUpdate = document.getElementById("last-update");
  }

  setBackendLabel(label) {
    if (this.backendLabel) {
      this.backendLabel.textContent = label;
    }
  }

  setConnection(status, label) {
    if (!this.connectionPill) {
      return;
    }

    this.connectionPill.textContent = label;
    this.connectionPill.className = `pill ${status}`;
  }

  setLastUpdate(date = new Date()) {
    if (this.lastUpdate) {
      this.lastUpdate.textContent = date.toLocaleTimeString();
    }
  }

  addAlert(message, severity = "info") {
    if (!this.alertsList) {
      return;
    }

    const item = document.createElement("li");
    item.className = `alert-${severity}`;
    item.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> | ${message}`;
    this.alertsList.prepend(item);

    while (this.alertsList.children.length > 12) {
      this.alertsList.removeChild(this.alertsList.lastChild);
    }
  }
}
