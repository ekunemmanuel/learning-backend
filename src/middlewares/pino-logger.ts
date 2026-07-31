import { pinoLogger as logger } from "hono-pino";
import pino from "pino";

import env from "@/env";

export function pinoLogger() {
  const targets: any[] = [];

  if (env.NODE_ENV !== "production") {
    targets.push({
      target: "pino-pretty",
      options: {},
    });
  }
  else {
    targets.push({
      target: "pino/file",
      options: { destination: 1 }, // stdout
    });
  }

  if (env.LOGTAIL_SOURCE_TOKEN && env.LOGTAIL_SOURCE_TOKEN !== "paste_your_better_stack_source_token_here") {
    targets.push({
      target: "@logtail/pino",
      options: { sourceToken: env.LOGTAIL_SOURCE_TOKEN },
    });
  }

  return logger({
    pino: pino(
      { level: env.LOG_LEVEL || "info" },
      pino.transport({ targets }),
    ),
  });
}
