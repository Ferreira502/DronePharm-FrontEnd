import { createPageDeps, runPage } from "../bootstrap-page.js";
import { DronesController } from "../controllers/drones-controller.js";
import { DronesView } from "../views/drones-view.js";

runPage(async () => {
  const deps = await createPageDeps({ view: new DronesView() });
  const controller = new DronesController(deps);
  await controller.init();
});
