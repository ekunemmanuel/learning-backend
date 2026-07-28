import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

import type { AppRouteHandler } from "@/lib/types";

import { AppError } from "@/lib/errors";

import type { CreateRoute, GetOneRoute, ListRoute, PatchRoute, RemoveRoute } from "./routes";
import * as ExampleService from "./services";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const examples = await ExampleService.getExamples();
  return c.json(examples);
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const example = c.req.valid("json");
  const inserted = await ExampleService.createExample(example);
  return c.json(inserted, HttpStatusCodes.OK);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const example = await ExampleService.getExampleById(id);

  if (!example) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, HttpStatusPhrases.NOT_FOUND);
  }

  return c.json(example, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const updates = c.req.valid("json");

  if (Object.keys(updates).length === 0) {
    throw new AppError(HttpStatusCodes.UNPROCESSABLE_ENTITY, "No updates provided");
  }

  const example = await ExampleService.updateExample(id, updates);
  return c.json(example, HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  
  await ExampleService.deleteExample(id);
  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
