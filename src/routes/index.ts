import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { createRouter } from "@/lib/create-app";

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      summary: "API Health & Root Index",
      description: "Returns the root health check message for the Accounts & Authentication API.",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema("Accounts & Authentication API"),
          "Accounts & Authentication API Index",
        ),
      },
    }),
    (c) => {
      return c.json({
        message: "Accounts & Authentication API",
      }, HttpStatusCodes.OK);
    },
  );

export default router;
