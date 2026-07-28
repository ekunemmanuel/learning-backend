import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { errorSchema } from "@/lib/constants";

import { createAccountSchema, loginSchema, verifyOtpSchema } from "./schema";

const tags = ["Auth"];

export const signup = createRoute({
  path: "/signup",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(
      createAccountSchema,
      "The example to create",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({}),
      "The created account",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "The validation error(s)",
    ),
  },
});

export const verify = createRoute({
  path: "/verify",
  method: "post",
  request: {
    body: jsonContentRequired(
      verifyOtpSchema,
      "The example to create",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({}),
      "OTP verified successfully",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "The validation error(s)",
    ),
  },
});

export const login = createRoute({
  path: "/login",
  method: "post",
  request: {
    body: jsonContentRequired(
      loginSchema,
      "The example to create",
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({}),
      "Login Successfully",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      errorSchema,
      "The validation error(s)",
    ),
  },
});

export type SignRoute = typeof signup;
export type VerifyRoute = typeof verify;
export type LoginRoute = typeof login