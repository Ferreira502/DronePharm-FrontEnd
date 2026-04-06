import { loadRuntimeConfig } from "./config/runtime-config.js";
import { createStore } from "./core/store.js";
import { DashboardController } from "./controllers/dashboard-controller.js";
import { DashboardModel } from "./models/dashboard-model.js";
import { HttpClient } from "./services/http-client.js";
import { SocketService } from "./services/socket-service.js";
import { DashboardView } from "./views/dashboard-view.js";
import { MapView } from "./views/map-view.js";

async function bootstrap() {
  const runtimeConfig = await loadRuntimeConfig();
  const controller = new DashboardController({
    config: runtimeConfig,
    model: new DashboardModel(new HttpClient()),
    view: new DashboardView(),
    mapView: new MapView("map"),
    socketService: new SocketService(),
    store: createStore({ reportCache: null }),
  });

  await controller.init();
}

bootstrap().catch((error) => {
  const alertsList = document.getElementById("alerts-list");
  if (alertsList) {
    const item = document.createElement("li");
    item.className = "alert-danger";
    item.textContent = `Falha ao iniciar a aplicacao: ${error.message}`;
    alertsList.appendChild(item);
  }
});
