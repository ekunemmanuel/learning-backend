import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";
import { strictRateLimiter } from "@/middlewares/rate-limiter";

import * as handlers from "./handlers";
import * as routes from "./routes";

const router = createRouter().basePath("/auth");

// Rate limiting on all auth routes
router.use(strictRateLimiter);

// ─── Public routes (no authentication required) ──────────────────────────────
router
  .openapi(routes.signup, handlers.signup)
  .openapi(routes.verify, handlers.verify)
  .openapi(routes.login, handlers.login)
  .openapi(routes.loginMfa, handlers.loginMfa)
  .openapi(routes.resendOtp, handlers.resendOtp)
  .openapi(routes.resetPassword, handlers.resetPassword)
  .openapi(routes.logout, handlers.logout);

// ─── Authenticated routes (session required) ─────────────────────────────────
router.use(authMiddleware);

router
  .openapi(routes.refresh, handlers.refresh)
  .openapi(routes.getMe, handlers.getMe)
  .openapi(routes.mfaSetup, handlers.mfaSetup)
  .openapi(routes.mfaVerify, handlers.mfaVerify)
  .openapi(routes.mfaPage, handlers.mfaPage)
  .openapi(routes.createApiToken, handlers.createApiToken);

export default router;
