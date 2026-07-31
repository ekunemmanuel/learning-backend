import type { MiddlewareHandler } from "hono";

import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError } from "@/lib/errors";

/**
 * Role-Based Access Control (RBAC) Permission Middleware
 *
 * Verifies that the caller's active membership possesses the required permission key.
 * Organization Owners automatically bypass permission checks.
 */
export function requirePermission(permissionKey: string): MiddlewareHandler {
  return async (c, next) => {
    const membership = c.get("membership") as any;

    if (!membership) {
      throw new AppError(
        HttpStatusCodes.FORBIDDEN,
        "Tenant membership context missing. Add tenantMiddleware before permission checks.",
      );
    }

    // Owner role has full administrative bypass
    if (membership.role?.name === "Owner") {
      await next();
      return;
    }

    const hasPermission = membership.role?.rolePermissions?.some(
      (rp: any) => rp.permission?.key === permissionKey,
    );

    if (!hasPermission) {
      throw new AppError(
        HttpStatusCodes.FORBIDDEN,
        `Forbidden - Required permission '${permissionKey}' is missing from your role`,
      );
    }

    await next();
  };
}
