import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

import { createExamplesSchema, updateExamplesSchema, listExamplesSchema } from "@/routes/examples/schema";
import { errorSchema, notFoundSchema } from "@/lib/constants";

import { strictRateLimiter } from "@/middlewares/rate-limiter";

const tags = ["Examples"];

export const list = createRoute({
  path: "/examples",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(listExamplesSchema),
      "The list of examples",
    ),
  },
});

export const create = createRoute({
  middleware: [strictRateLimiter],
  path: "/examples",
  method: "post",
  request: {
    body: jsonContentRequired(
      createExamplesSchema,
      "The example to create",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      listExamplesSchema,
      "The created example",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "The validation error(s)",
    ),
  },
});

export const getOne = createRoute({
  path: "/examples/{id}",
  method: "get",
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      listExamplesSchema,
      "The requested example",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Example not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "Invalid id error",
    ),
  },
});

export const patch = createRoute({
  middleware: [strictRateLimiter],
  path: "/examples/{id}",
  method: "patch",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      updateExamplesSchema,
      "The example updates",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      listExamplesSchema,
      "The updated example",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Example not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "The validation error(s)",
    ),
  },
});

export const remove = createRoute({
  middleware: [strictRateLimiter],
  path: "/examples/{id}",
  method: "delete",
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Example deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Example not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "Invalid id error",
    ),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
