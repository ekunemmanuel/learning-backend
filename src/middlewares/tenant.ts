import type { MiddlewareHandler } from "hono";
import { prisma as db } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import * as HttpStatusCodes from "stoker/http-status-codes";

/**
 * Tenant Middleware
 *
 * Extracts organization context from URL parameter (`idOrSlug`) or header (`x-organization-id`).
 * Verifies that the caller has an active Membership in the organization.
 * Stamps `organizationId`, `organization`, and `membership` on request context.
 */
export const tenantMiddleware: MiddlewareHandler = async (c, next) => {
  const userId = c.get("userId");

  if (!userId) {
    throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized - Missing user context");
  }

  const idOrSlug = c.req.param("idOrSlug") || c.req.header("x-organization-id");

  if (!idOrSlug) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "Organization ID or slug is required to access this tenant resource"
    );
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);

  const organization = await db.organization.findFirst({
    where: {
      OR: isUuid ? [{ id: idOrSlug }, { slug: idOrSlug }] : [{ slug: idOrSlug }],
      deletedAt: null,
    },
  });

  if (!organization) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "Organization not found");
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: organization.id,
      },
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== "active") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "You are not an active member of this organization"
    );
  }

  c.set("organizationId", organization.id);
  c.set("organization", organization);
  c.set("membership", membership);

  await next();
};
