import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";

import type { LoginRoute, SignRoute, VerifyRoute } from "./routes";
import * as AuthService from "./services";

export const signup: AppRouteHandler<SignRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.createAccount(data);
  return c.json(result, HttpStatusCodes.CREATED);
};

export const verify: AppRouteHandler<VerifyRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.verifyOtp(data);
  return c.json(result, HttpStatusCodes.OK);
};


export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.login(data);
  return c.json(result, HttpStatusCodes.OK);
};

