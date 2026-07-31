import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import {
  acceptInvitationSchema,
  createInvitationSchema,
  createOrganizationSchema,
  invitationListResponseSchema,
  invitationParamSchema,
  invitationSchema,
  memberListResponseSchema,
  memberParamSchema,
  memberSchema,
  organizationListResponseSchema,
  organizationMessageResponseSchema,
  organizationParamSchema,
  organizationSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "./schema";

const tags = ["Organizations"];

// ============================================================================
// ORGANIZATION ROUTES
// ============================================================================

export const createOrganizationRoute = createRoute({
  path: "/organizations",
  method: "post",
  tags,
  summary: "Create Organization",
  description: "Creates a new multi-tenant organization workspace and assigns the caller as Owner.",
  request: {
    body: jsonContent(createOrganizationSchema, "Organization creation payload"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      organizationSchema,
      "Organization workspace created successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(organizationMessageResponseSchema, "Validation error"),
  },
});

export const getUserOrganizationsRoute = createRoute({
  path: "/organizations",
  method: "get",
  tags,
  summary: "List Organizations",
  description: "Retrieves all active organizations the authenticated user belongs to.",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationListResponseSchema,
      "List of user organizations",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
  },
});

export const getOrganizationRoute = createRoute({
  path: "/organizations/{idOrSlug}",
  method: "get",
  tags,
  summary: "Get Organization",
  description: "Retrieves organization workspace details by UUID or slug (requires active membership).",
  request: {
    params: organizationParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationSchema,
      "Organization details",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Organization not found"),
  },
});

export const updateOrganizationRoute = createRoute({
  path: "/organizations/{idOrSlug}",
  method: "patch",
  tags,
  summary: "Update Organization",
  description: "Updates organization workspace settings (Requires Owner or Admin role).",
  request: {
    params: organizationParamSchema,
    body: jsonContent(updateOrganizationSchema, "Organization update payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationSchema,
      "Organization updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Organization not found"),
    [HttpStatusCodes.CONFLICT]: jsonContent(organizationMessageResponseSchema, "Conflict"),
  },
});

export const deleteOrganizationRoute = createRoute({
  path: "/organizations/{idOrSlug}",
  method: "delete",
  tags,
  summary: "Delete Organization",
  description: "Soft-deletes an organization workspace (Requires Owner role).",
  request: {
    params: organizationParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationMessageResponseSchema,
      "Organization deleted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Organization not found"),
  },
});

// ============================================================================
// MEMBERSHIP ROUTES
// ============================================================================

export const getOrganizationMembersRoute = createRoute({
  path: "/organizations/{idOrSlug}/members",
  method: "get",
  tags,
  summary: "List Organization Members",
  description: "Retrieves all team members and assigned roles in an organization.",
  request: {
    params: organizationParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      memberListResponseSchema,
      "List of organization members",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
  },
});

export const updateMemberRoleRoute = createRoute({
  path: "/organizations/{idOrSlug}/members/{memberId}",
  method: "patch",
  tags,
  summary: "Update Member Role",
  description: "Updates a team member's role (Requires Owner or Admin role).",
  request: {
    params: memberParamSchema,
    body: jsonContent(updateMemberRoleSchema, "Role update payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      memberSchema,
      "Member role updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Member not found"),
  },
});

export const removeMemberRoute = createRoute({
  path: "/organizations/{idOrSlug}/members/{memberId}",
  method: "delete",
  tags,
  summary: "Remove Member",
  description: "Removes a member from the organization or allows a user to self-leave.",
  request: {
    params: memberParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationMessageResponseSchema,
      "Member removed successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Member not found"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(organizationMessageResponseSchema, "Bad Request"),
  },
});

// ============================================================================
// INVITATION ROUTES
// ============================================================================

export const createInvitationRoute = createRoute({
  path: "/organizations/{idOrSlug}/invitations",
  method: "post",
  tags,
  summary: "Invite Team Member",
  description: "Creates and sends a tokenized invitation to a new team member's email (Requires Owner or Admin role).",
  request: {
    params: organizationParamSchema,
    body: jsonContent(createInvitationSchema, "Invitation creation payload"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      invitationSchema,
      "Invitation created successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(organizationMessageResponseSchema, "Bad Request"),
  },
});

export const getOrganizationInvitationsRoute = createRoute({
  path: "/organizations/{idOrSlug}/invitations",
  method: "get",
  tags,
  summary: "List Pending Invitations",
  description: "Retrieves all active pending invitations for an organization.",
  request: {
    params: organizationParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      invitationListResponseSchema,
      "List of pending invitations",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
  },
});

export const cancelInvitationRoute = createRoute({
  path: "/organizations/{idOrSlug}/invitations/{invitationId}",
  method: "delete",
  tags,
  summary: "Cancel Invitation",
  description: "Revokes a pending organization invitation.",
  request: {
    params: invitationParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationMessageResponseSchema,
      "Invitation cancelled successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(organizationMessageResponseSchema, "Forbidden"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(organizationMessageResponseSchema, "Invitation not found"),
  },
});

export const acceptInvitationRoute = createRoute({
  path: "/organizations/invitations/accept",
  method: "post",
  tags,
  summary: "Accept Invitation",
  description: "Accepts an organization invitation token and joins the workspace.",
  request: {
    body: jsonContent(acceptInvitationSchema, "Invitation acceptance payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      organizationMessageResponseSchema,
      "Invitation accepted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(organizationMessageResponseSchema, "Unauthorized"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(organizationMessageResponseSchema, "Invalid or expired token"),
  },
});

export type CreateOrganizationRoute = typeof createOrganizationRoute;
export type GetUserOrganizationsRoute = typeof getUserOrganizationsRoute;
export type GetOrganizationRoute = typeof getOrganizationRoute;
export type UpdateOrganizationRoute = typeof updateOrganizationRoute;
export type DeleteOrganizationRoute = typeof deleteOrganizationRoute;
export type GetOrganizationMembersRoute = typeof getOrganizationMembersRoute;
export type UpdateMemberRoleRoute = typeof updateMemberRoleRoute;
export type RemoveMemberRoute = typeof removeMemberRoute;
export type CreateInvitationRoute = typeof createInvitationRoute;
export type GetOrganizationInvitationsRoute = typeof getOrganizationInvitationsRoute;
export type CancelInvitationRoute = typeof cancelInvitationRoute;
export type AcceptInvitationRoute = typeof acceptInvitationRoute;
