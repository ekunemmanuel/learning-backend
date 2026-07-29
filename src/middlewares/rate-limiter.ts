import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

import env from "@/env";

// We extract the IP address from the request.
// If you are behind a reverse proxy (like Cloudflare or Nginx), you might need to use `c.req.header("x-forwarded-for")`.
const keyGenerator = (c: Context) => {
  try {
    const info = getConnInfo(c);
    return info.remote.address || "anonymous";
  } catch (err) {
    // In test environments, getConnInfo throws because c.env is missing
    return "anonymous";
  }
};

const passThrough = async (c: Context, next: any) => await next();

// Global Rate Limiter: Applies to ALL routes by default.
// 100 requests per 15 minutes per IP.
export const globalRateLimiter = env.NODE_ENV === "test" ? passThrough : rateLimiter({
  windowMs: 15 * 60 * 1000, 
  limit: 100, 
  standardHeaders: "draft-6",
  keyGenerator,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

// Specific Rate Limiter: For sensitive actions (POST, PATCH, DELETE).
// 5 requests per 1 minute per IP.
export const strictRateLimiter = env.NODE_ENV === "test" ? passThrough : rateLimiter({
  windowMs: 1 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-6",
  keyGenerator,
  message: {
    success: false,
    message: "Too many sensitive actions. Please wait a minute.",
  },
});
