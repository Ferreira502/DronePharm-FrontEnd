import { createPageDeps, runPage } from "../bootstrap-page.js";
import { HomeController } from "../controllers/home-controller.js";
import { HomeView } from "../views/home-view.js";

runPage(async () => {
  const deps = await createPageDeps({ view: new HomeView() });
  const controller = new HomeController(deps);
  await controller.init();
});
