import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { z } from "@hono/zod-openapi";

export const ZOD_ERROR_MESSAGES = {
  REQUIRED: "Required",
  EXPECTED_NUMBER: "Invalid input: expected number, received NaN",
  NO_UPDATES: "No updates provided",
  EXPECTED_STRING: "Invalid input: expected string, received undefined",
};

export const ZOD_ERROR_CODES = {
  INVALID_UPDATES: "invalid_updates",
};

export const errorSchema = z.object({
  message: z.string(),
  success: z.boolean().default(false),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
});

export const notFoundSchema = errorSchema.openapi({
  example: {
    message: HttpStatusPhrases.NOT_FOUND,
    success: false,
  },
});
