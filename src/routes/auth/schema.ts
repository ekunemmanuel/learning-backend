import { z } from "@hono/zod-openapi";

// Regex for E.164 International Phone Format (e.g. +1234567890, +2348012345678)
const e164PhoneRegex = /^\+[1-9]\d{1,14}$/;

// OTP Type Enum Schema
export const otpTypeSchema = z.enum(["email_verification", "phone_verification", "password_reset"]);

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// Signup Request Schema
export const createAccountSchema = z.object({
  name: z.string().min(1).max(500),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain alphanumeric characters, underscores, and hyphens").optional(),
  phone: z.string().regex(e164PhoneRegex, "Phone number must be in E.164 international format (e.g. +1234567890)").optional(),
  country: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

// Verify OTP Request Schema (including type)
export const verifyOtpSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().min(4).max(6),
  type: otpTypeSchema.default("email_verification"),
});

// Login Request Schema (Identifier = Email OR E.164 Phone OR Username)
export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  mfaCode: z.string().min(6).max(8).optional(),
});

// Dedicated MFA Login Step Request Schema
export const loginMfaSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  mfaCode: z.string().min(6).max(8),
});

// Resend OTP Request Schema (Purpose = email_verification, phone_verification, or password_reset)
export const resendOtpSchema = z.object({
  identifier: z.string().min(1),
  purpose: otpTypeSchema.default("email_verification"),
});

// Refresh Session Token Request Schema (Optional body if using HTTP-Only cookie)
export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

// Logout Request Schema (Optional body if using HTTP-Only cookie)
export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

// Reset Password Request Schema
export const resetPasswordSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().min(4).max(6),
  newPassword: z.string().min(8).max(100),
});

// MFA Setup Request Schema
export const mfaSetupSchema = z.object({
  type: z.enum(["totp", "webauthn", "sms"]).default("totp"),
  name: z.string().min(1).max(100).default("Authenticator App"),
});

// MFA Verification Request Schema
export const mfaVerifySchema = z.object({
  methodId: z.string().min(1),
  code: z.string().length(6),
});

// Create API Token Request Schema
export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
  expiresInDays: z.number().int().positive().optional(),
});


// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const signupResponseSchema = z.object({
  message: z.string(),
});

export const verifyResponseSchema = z.object({
  message: z.string(),
});

export const loginResponseSchema = z.object({
  message: z.string(),
  mfaRequired: z.boolean().default(false),
  user: z.object({
    email: z.string(),
    name: z.string().nullable(),
  }).nullable().optional(),
  refreshToken: z.string().nullable().optional(),
});

export const getMeResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isEmailVerified: z.boolean(),
  emailVerifiedAt: z.string().nullable().optional(),
  isPhoneVerified: z.boolean(),
  phoneVerifiedAt: z.string().nullable().optional(),
});

export const resendOtpResponseSchema = z.object({
  message: z.string(),
});

export const refreshResponseSchema = z.object({
  message: z.string(),
  refreshToken: z.string(),
});

export const logoutResponseSchema = z.object({
  message: z.string(),
});

export const resetPasswordResponseSchema = z.object({
  message: z.string(),
});

export const mfaSetupResponseSchema = z.object({
  message: z.string(),
  methodId: z.string(),
  secret: z.string(),
  qrCodePayload: z.string(),
  qrCodeDataUrl: z.string().optional(),
});

export const mfaVerifyResponseSchema = z.object({
  message: z.string(),
  backupCodes: z.array(z.string()),
});

export const createApiTokenResponseSchema = z.object({
  message: z.string(),
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  apiToken: z.string(),
});


// Types
export type CreateAccountSchema = z.infer<typeof createAccountSchema>;
export type VerifyOtpSchema = z.infer<typeof verifyOtpSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type LoginMfaSchema = z.infer<typeof loginMfaSchema>;
export type ResendOtpSchema = z.infer<typeof resendOtpSchema>;
export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;
export type LogoutSchema = z.infer<typeof logoutSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type MfaSetupSchema = z.infer<typeof mfaSetupSchema>;
export type MfaVerifySchema = z.infer<typeof mfaVerifySchema>;
export type CreateApiTokenSchema = z.infer<typeof createApiTokenSchema>;