import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import type {
  AcceptInvitationRoute,
  CancelInvitationRoute,
  CreateInvitationRoute,
  CreateOrganizationRoute,
  DeleteOrganizationRoute,
  GetOrganizationInvitationsRoute,
  GetOrganizationMembersRoute,
  GetOrganizationRoute,
  GetUserOrganizationsRoute,
  RemoveMemberRoute,
  UpdateMemberRoleRoute,
  UpdateOrganizationRoute,
} from "./routes";

import * as services from "./services";

// Organization Handlers
export const createOrganization: AppRouteHandler<CreateOrganizationRoute> = async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const organization = await services.createOrganization(userId, data);
  return c.json(organization, HttpStatusCodes.CREATED);
};

export const getUserOrganizations: AppRouteHandler<GetUserOrganizationsRoute> = async (c) => {
  const userId = c.get("userId");

  const organizations = await services.getUserOrganizations(userId);
  return c.json(organizations, HttpStatusCodes.OK);
};

export const getOrganization: AppRouteHandler<GetOrganizationRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");

  const organization = await services.getOrganizationByIdOrSlug(userId, idOrSlug);
  return c.json(organization, HttpStatusCodes.OK);
};

export const updateOrganization: AppRouteHandler<UpdateOrganizationRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");
  const data = c.req.valid("json");

  const updatedOrg = await services.updateOrganization(userId, idOrSlug, data);
  return c.json(updatedOrg, HttpStatusCodes.OK);
};

export const deleteOrganization: AppRouteHandler<DeleteOrganizationRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");

  const result = await services.deleteOrganization(userId, idOrSlug);
  return c.json(result, HttpStatusCodes.OK);
};

// Membership Handlers
export const getOrganizationMembers: AppRouteHandler<GetOrganizationMembersRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");

  const members = await services.getOrganizationMembers(userId, idOrSlug);
  return c.json(members, HttpStatusCodes.OK);
};

export const updateMemberRole: AppRouteHandler<UpdateMemberRoleRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug, memberId } = c.req.valid("param");
  const data = c.req.valid("json");

  const updatedMember = await services.updateMemberRole(userId, idOrSlug, memberId, data);
  return c.json(updatedMember, HttpStatusCodes.OK);
};

export const removeMember: AppRouteHandler<RemoveMemberRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug, memberId } = c.req.valid("param");

  const result = await services.removeMember(userId, idOrSlug, memberId);
  return c.json(result, HttpStatusCodes.OK);
};

// Invitation Handlers
export const createInvitation: AppRouteHandler<CreateInvitationRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");
  const data = c.req.valid("json");

  const invitation = await services.createInvitation(userId, idOrSlug, data);
  return c.json(invitation, HttpStatusCodes.CREATED);
};

export const getOrganizationInvitations: AppRouteHandler<GetOrganizationInvitationsRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug } = c.req.valid("param");

  const invitations = await services.getOrganizationInvitations(userId, idOrSlug);
  return c.json(invitations, HttpStatusCodes.OK);
};

export const cancelInvitation: AppRouteHandler<CancelInvitationRoute> = async (c) => {
  const userId = c.get("userId");
  const { idOrSlug, invitationId } = c.req.valid("param");

  const result = await services.cancelInvitation(userId, idOrSlug, invitationId);
  return c.json(result, HttpStatusCodes.OK);
};

export const acceptInvitation: AppRouteHandler<AcceptInvitationRoute> = async (c) => {
  const userId = c.get("userId");
  const { token } = c.req.valid("json");

  const result = await services.acceptInvitation(userId, token);
  return c.json(result, HttpStatusCodes.OK);
};
