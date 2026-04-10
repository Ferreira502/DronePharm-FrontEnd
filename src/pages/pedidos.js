import { createPageDeps, runPage } from "../bootstrap-page.js";
import { PedidosController } from "../controllers/pedidos-controller.js";
import { PedidosView } from "../views/pedidos-view.js";

runPage(async () => {
  const deps = await createPageDeps({ view: new PedidosView() });
  const controller = new PedidosController(deps);
  await controller.init();
});
