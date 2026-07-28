import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";
import { prisma as db } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { hashText } from "@/routes/auth/utils";

/**
 * Authentication Middleware
 *
 * Protects routes by verifying the caller's session.
 * Accepts the refresh token from one of three sources (checked in order):
 *   1. HTTP-Only cookie (`refreshToken`) — set automatically on login
 *   2. Authorization header  (`Bearer <token>`)
 *   3. `x-refresh-token` header — useful for mobile / non-browser clients
 *
 * On success, sets `c.set("userId", ...)` and `c.set("sessionId", ...)`
 * so that downstream handlers can identify the authenticated user without
 * hitting the database again.
 *
 * On failure, throws a 401 Unauthorized error.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // 1. Read token from cookie, Authorization Bearer, or x-refresh-token header
  let rawToken =
    getCookie(c, "refreshToken") ||
    c.req.header("x-refresh-token") ||
    null;

  const authHeader = c.req.header("Authorization");
  if (!rawToken && authHeader?.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7).trim();
  }

  if (!rawToken) {
    throw new AppError(
      HttpStatusCodes.UNAUTHORIZED,
      "You must be signed in to access this resource"
    );
  }

  // 2. Hash the token and look it up against active sessions
  const tokenHash = await hashText(rawToken);

  const session = await db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  // 3. Reject if session is missing, revoked, or expired
  if (!session) {
    throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Session not found. Please sign in again");
  }

  if (session.revokedAt) {
    throw new AppError(
      HttpStatusCodes.UNAUTHORIZED,
      "Your session has been revoked. Please sign in again"
    );
  }

  if (session.expiresAt < new Date()) {
    throw new AppError(
      HttpStatusCodes.UNAUTHORIZED,
      "Your session has expired. Please sign in again"
    );
  }

  // 4. Stamp the authenticated context so handlers can use it
  c.set("userId", session.userId);
  c.set("sessionId", session.id);

  await next();
};
