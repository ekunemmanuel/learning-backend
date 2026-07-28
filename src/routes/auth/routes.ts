import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { errorSchema } from "@/lib/constants";

import {
  createAccountSchema,
  loginSchema,
  loginMfaSchema,
  verifyOtpSchema,
  resendOtpSchema,
  refreshTokenSchema,
  logoutSchema,
  resetPasswordSchema,
  mfaSetupSchema,
  mfaVerifySchema,
  createApiTokenSchema,
  signupResponseSchema,
  verifyResponseSchema,
  loginResponseSchema,
  getMeResponseSchema,
  resendOtpResponseSchema,
  refreshResponseSchema,
  logoutResponseSchema,
  resetPasswordResponseSchema,
  mfaSetupResponseSchema,
  mfaVerifyResponseSchema,
  createApiTokenResponseSchema,
} from "./schema";

const tags = ["Auth"];

export const signup = createRoute({
  path: "/signup",
  method: "post",
  tags,
  summary: "Create a new account",
  description: "Creates a new user profile with your details and sends a verification code to your email or phone.",
  request: {
    body: jsonContentRequired(createAccountSchema, "User signup details"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(signupResponseSchema, "Account created successfully"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, "Bad Request"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const verify = createRoute({
  path: "/verify",
  method: "post",
  tags,
  summary: "Verify your email or phone with a code",
  description: "Validates the verification code sent to your email or phone to activate your account or confirm password reset.",
  request: {
    body: jsonContentRequired(verifyOtpSchema, "OTP verification payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(verifyResponseSchema, "OTP verified successfully"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, "Invalid or expired OTP"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const login = createRoute({
  path: "/login",
  method: "post",
  tags,
  summary: "Sign in to your account",
  description: "Authenticates using your email, phone number, or username and returns your profile and session cookie or indicates if MFA is required.",
  request: {
    body: jsonContentRequired(loginSchema.omit({ mfaCode: true }), "User login credentials"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, "Login Successful or MFA Required"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, "Invalid credentials"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, "MFA code required"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const loginMfa = createRoute({
  path: "/login/mfa",
  method: "post",
  tags,
  summary: "Sign in with two-factor authentication",
  description: "Submits your credentials along with your 6-digit authenticator code or emergency backup code to finalize your sign in.",
  request: {
    body: jsonContentRequired(loginMfaSchema, "MFA login credentials"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, "Login Successful"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, "Invalid credentials or MFA code"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const getMe = createRoute({
  path: "/me",
  method: "get",
  tags,
  summary: "Get current user profile",
  description: "Fetches complete profile details for the currently authenticated user.",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(getMeResponseSchema, "User profile retrieved successfully"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, "Unauthorized"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, "User not found"),
  },
});

export const resendOtp = createRoute({
  path: "/resend-otp",
  method: "post",
  tags,
  summary: "Send a new verification or password reset code",
  description: "Sends a new security code for verifying your email, phone, or starting a password reset.",
  request: {
    body: jsonContentRequired(resendOtpSchema, "Resend OTP payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(resendOtpResponseSchema, "OTP dispatched successfully"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const refresh = createRoute({
  path: "/refresh",
  method: "post",
  tags,
  summary: "Extend your login session",
  description: "Extends your active login session using your session cookie or refresh token.",
  request: {
    body: jsonContent(refreshTokenSchema, "Refresh token payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(refreshResponseSchema, "Session refreshed successfully"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, "Invalid session"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const logout = createRoute({
  path: "/logout",
  method: "post",
  tags,
  summary: "Sign out",
  description: "Signs you out of your current device and clears your session cookie.",
  request: {
    body: jsonContent(logoutSchema, "Logout session payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(logoutResponseSchema, "Logged out successfully"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const resetPassword = createRoute({
  path: "/reset-password",
  method: "post",
  tags,
  summary: "Change your password using a reset code",
  description: "Sets a new password for your account using the verified security code sent to you.",
  request: {
    body: jsonContentRequired(resetPasswordSchema, "Reset password payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(resetPasswordResponseSchema, "Password reset successfully"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, "Invalid reset code"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const mfaSetup = createRoute({
  path: "/mfa/setup",
  method: "post",
  tags,
  summary: "Start setting up two-factor authentication",
  description: "Generates a secret key and QR code to connect your account to an authenticator app.",
  request: {
    body: jsonContentRequired(mfaSetupSchema, "MFA setup payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(mfaSetupResponseSchema, "MFA setup initiated"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const mfaVerify = createRoute({
  path: "/mfa/verify",
  method: "post",
  tags,
  summary: "Finish setting up two-factor authentication",
  description: "Confirms your authenticator app code, activates two-factor authentication, and gives you backup codes.",
  request: {
    body: jsonContentRequired(mfaVerifySchema, "MFA verification payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(mfaVerifyResponseSchema, "MFA enabled successfully"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, "Method not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export const mfaPage = createRoute({
  path: "/mfa/page",
  method: "get",
  tags,
  summary: "Google Authenticator MFA Interactive UI",
  description: "Serves an interactive web page to scan QR codes and verify TOTP setup with Google Authenticator.",
  responses: {
    [HttpStatusCodes.OK]: {
      description: "MFA Setup HTML Page",
      content: {
        "text/html": {
          schema: { type: "string" },
        },
      },
    },
  },
});

export const createApiToken = createRoute({
  path: "/api-tokens",
  method: "post",
  tags,
  summary: "Create a new API key",
  description: "Generates a personal API key so developer tools or scripts can interact with your account.",
  request: {
    body: jsonContentRequired(createApiTokenSchema, "API Token payload"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(createApiTokenResponseSchema, "API Token created"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(errorSchema, "Validation Error"),
  },
});

export type SignRoute = typeof signup;
export type VerifyRoute = typeof verify;
export type LoginRoute = typeof login;
export type LoginMfaRoute = typeof loginMfa;
export type GetMeRoute = typeof getMe;
export type ResendOtpRoute = typeof resendOtp;
export type RefreshRoute = typeof refresh;
export type LogoutRoute = typeof logout;
export type ResetPasswordRoute = typeof resetPassword;
export type MfaSetupRoute = typeof mfaSetup;
export type MfaVerifyRoute = typeof mfaVerify;
export type MfaPageRoute = typeof mfaPage;
export type CreateApiTokenRoute = typeof createApiToken;