import { createPageDeps, runPage } from "../bootstrap-page.js";
import { OperationsController } from "../controllers/operations-controller.js";
import { OperationsView } from "../views/operations-view.js";

runPage(async () => {
  const deps = await createPageDeps({ view: new OperationsView() });
  const controller = new OperationsController(deps);
  await controller.init();
});
