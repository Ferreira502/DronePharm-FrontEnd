import { loadRuntimeConfig } from "./config/runtime-config.js";
import { DashboardModel } from "./models/dashboard-model.js";
import { HttpClient } from "./services/http-client.js";
import { SocketService } from "./services/socket-service.js";
import { ShellView } from "./views/shell-view.js";

export async function createPageDeps(extra = {}) {
  const config = await loadRuntimeConfig();

  return {
    config,
    model: new DashboardModel(new HttpClient()),
    shellView: new ShellView(),
    socketService: new SocketService(),
    ...extra,
  };
}

export async function runPage(factory) {
  try {
    await factory();
  } catch (error) {
    const alertsList = document.getElementById("alerts-list");
    if (alertsList) {
      const item = document.createElement("li");
      item.className = "alert-danger";
      item.textContent = `Falha ao iniciar a pagina: ${error.message}`;
      alertsList.appendChild(item);
    }
  }
}
