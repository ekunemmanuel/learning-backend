import type { Schema } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import { notFound, serveEmojiFavicon } from "stoker/middlewares";

import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { pinoLogger } from "@/middlewares/pino-logger";
import { errorHandler, validationHook } from "@/middlewares/error-handler";
import { globalRateLimiter } from "@/middlewares/rate-limiter";

import type { AppBindings, AppOpenAPI } from "./types";
import env from "@/env";
import { responseFormatter } from "@/middlewares/response-formatter";

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
    allowHeaders: ["*"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    maxAge: 86400,
  }));
  app.use(secureHeaders());
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
