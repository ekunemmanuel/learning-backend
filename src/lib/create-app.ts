import type { Schema } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { notFound, serveEmojiFavicon } from "stoker/middlewares";

import env from "@/env";
import { errorHandler, validationHook } from "@/middlewares/error-handler";
import { pinoLogger } from "@/middlewares/pino-logger";
import { globalRateLimiter } from "@/middlewares/rate-limiter";
import { responseFormatter } from "@/middlewares/response-formatter";

import type { AppBindings, AppOpenAPI } from "./types";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: validationHook,
  });
}

export default function createApp() {
  const app = createRouter();

  // Security middlewares
  app.use(cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-refresh-token"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    credentials: true,
    maxAge: 86400,
  }));
  app.use(secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
  }));
  app.use(globalRateLimiter);

  // Core middlewares
  app.use(requestId())
    .use(serveEmojiFavicon("📝"))
    .use(pinoLogger())
    .use(responseFormatter);

  app.notFound(notFound);
  app.onError(errorHandler);
  return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route("/", router);
}
