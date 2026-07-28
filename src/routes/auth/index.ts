import { createRouter } from "@/lib/create-app";

import * as handlers from "./handlers";
import * as routes from "./routes";
import { strictRateLimiter } from "@/middlewares/rate-limiter";

const router = createRouter().basePath("/auth");

router.use(strictRateLimiter);

export default router
  .openapi(routes.signup, handlers.signup)
  .openapi(routes.verify, handlers.verify)
  .openapi(routes.login, handlers.login);

