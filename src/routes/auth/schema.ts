import { z } from "@hono/zod-openapi";

// create account schema
export const createAccountSchema = z.object({
  name: z.string().min(1).max(500),
  email: z.email(),
  password: z.string().min(1).max(500),
  phone: z.string().min(11).max(13),
});

// verify otp schema
export const verifyOtpSchema = z.object({
  identifier: z.union([z.email(), z.string().min(11).max(13)]),
  code: z.string().min(4).max(6),
});

// loin schema
export const loginSchema = z.object({
  identifier: z.union([z.email(), z.string().min(11).max(13)]),
  password: z.string().min(1)
})


// types
export type CreateAccountSchema = z.infer<typeof createAccountSchema>;
export type VerifyOtpSchema = z.infer<typeof verifyOtpSchema>;
export type LoginSchema = z.infer<typeof loginSchema>