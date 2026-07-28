import { createRouter } from "@/lib/create-app";
import { cacheMiddleware } from "@/middlewares/cache";

import * as handlers from "./handlers";
import * as routes from "./routes";

const router = createRouter();

router.use(cacheMiddleware());

export default router
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.patch, handlers.patch)
  .openapi(routes.remove, handlers.remove);
