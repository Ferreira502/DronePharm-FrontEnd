import { createPageDeps, runPage } from "../bootstrap-page.js";
import { FarmaciasController } from "../controllers/farmacias-controller.js";
import { FarmaciasView } from "../views/farmacias-view.js";

runPage(async () => {
  const deps = await createPageDeps({ view: new FarmaciasView() });
  const controller = new FarmaciasController(deps);
  await controller.init();
});
