import { createPageDeps, runPage } from "../bootstrap-page.js";
import { MapController } from "../controllers/map-controller.js";
import { MapView } from "../views/map-view.js";
import { MapPageView } from "../views/map-page-view.js";

runPage(async () => {
  const deps = await createPageDeps({
    view: new MapPageView(),
    mapView: new MapView("map"),
  });

  const controller = new MapController(deps);
  await controller.init();
});
