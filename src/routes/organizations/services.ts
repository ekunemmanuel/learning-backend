import { randomBytes } from "node:crypto";
import { prisma as db } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import * as HttpStatusCodes from "stoker/http-status-codes";
import env from "@/env";
import type {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrganizationSchema,
  MemberSchema,
  UpdateMemberRoleSchema,
  CreateInvitationSchema,
  InvitationSchema,
} from "./schema";

/**
 * Converts a display name into a clean, URL-friendly slug
 */
export function slugify(name: string): string {
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || "org";
}

/**
 * Generates a unique slug for an organization.
 */
async function generateUniqueSlug(baseName: string, customSlug?: string): Promise<string> {
  const baseSlug = customSlug ? slugify(customSlug) : slugify(baseName);

  const existing = await db.organization.findUnique({
    where: { slug: baseSlug },
  });

  if (!existing) {
    return baseSlug;
  }

  const suffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${suffix}`;
}

/**
 * Ensures system default roles (Owner, Admin, Member) exist in the database.
 */
export async function getOrCreateSystemRole(roleName: "Owner" | "Admin" | "Member") {
  const existingRole = await db.role.findFirst({
    where: {
      name: roleName,
      isSystem: true,
      organizationId: null,
    },
  });

  if (existingRole) {
    return existingRole;
  }

  return db.role.create({
    data: {
      name: roleName,
      isSystem: true,
      organizationId: null,
    },
  });
}

// ============================================================================
// ORGANIZATION SERVICES
// ============================================================================

export async function createOrganization(
  userId: string,
  data: CreateOrganizationSchema
): Promise<OrganizationSchema> {
  const slug = await generateUniqueSlug(data.name, data.slug);
  const ownerRole = await getOrCreateSystemRole("Owner");

  const organization = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.name.trim(),
        slug,
        billingPlan: data.billingPlan || "free",
        createdBy: userId,
      },
    });

    await tx.membership.create({
      data: {
        userId,
        organizationId: org.id,
        roleId: ownerRole.id,
        status: "active",
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        actorUserId: userId,
        action: "organization.created",
        targetType: "organization",
        targetId: org.id,
        metadata: { name: org.name, slug: org.slug, billingPlan: org.billingPlan },
      },
    });

    return org;
  });

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    billingPlan: organization.billingPlan,
    createdBy: organization.createdBy,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    memberCount: 1,
    role: "Owner",
  };
}

export async function getUserOrganizations(userId: string): Promise<OrganizationSchema[]> {
  const memberships = await db.membership.findMany({
    where: {
      userId,
      status: "active",
      organization: {
        deletedAt: null,
      },
    },
    include: {
      organization: {
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      },
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    billingPlan: m.organization.billingPlan,
    createdBy: m.organization.createdBy,
    createdAt: m.organization.createdAt.toISOString(),
    updatedAt: m.organization.updatedAt.toISOString(),
    memberCount: m.organization._count.memberships,
    role: m.role.name,
  }));
}

export async function getOrganizationByIdOrSlug(
  userId: string,
  idOrSlug: string
): Promise<OrganizationSchema> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);

  const organization = await db.organization.findFirst({
    where: {
      OR: isUuid ? [{ id: idOrSlug }, { slug: idOrSlug }] : [{ slug: idOrSlug }],
      deletedAt: null,
    },
    include: {
      _count: {
        select: { memberships: true },
      },
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
      role: true,
    },
  });

  if (!membership || membership.status !== "active") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "You are not an active member of this organization"
    );
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    billingPlan: organization.billingPlan,
    createdBy: organization.createdBy,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    memberCount: organization._count.memberships,
    role: membership.role.name,
  };
}

export async function updateOrganization(
  userId: string,
  idOrSlug: string,
  data: UpdateOrganizationSchema
): Promise<OrganizationSchema> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can update workspace settings"
    );
  }

  const updateData: Record<string, any> = {};

  if (data.name) {
    updateData.name = data.name.trim();
  }

  if (data.billingPlan) {
    updateData.billingPlan = data.billingPlan;
  }

  if (data.slug && data.slug !== currentOrg.slug) {
    const cleanSlug = slugify(data.slug);
    const existing = await db.organization.findFirst({
      where: {
        slug: cleanSlug,
        id: { not: currentOrg.id },
      },
    });

    if (existing) {
      throw new AppError(
        HttpStatusCodes.CONFLICT,
        `Organization slug '${cleanSlug}' is already taken`
      );
    }
    updateData.slug = cleanSlug;
  }

  const updatedOrg = await db.organization.update({
    where: { id: currentOrg.id },
    data: updateData,
    include: {
      _count: {
        select: { memberships: true },
      },
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: updatedOrg.id,
      actorUserId: userId,
      action: "organization.updated",
      targetType: "organization",
      targetId: updatedOrg.id,
      metadata: updateData,
    },
  });

  return {
    id: updatedOrg.id,
    name: updatedOrg.name,
    slug: updatedOrg.slug,
    billingPlan: updatedOrg.billingPlan,
    createdBy: updatedOrg.createdBy,
    createdAt: updatedOrg.createdAt.toISOString(),
    updatedAt: updatedOrg.updatedAt.toISOString(),
    memberCount: updatedOrg._count.memberships,
    role: currentOrg.role,
  };
}

export async function deleteOrganization(
  userId: string,
  idOrSlug: string
): Promise<{ message: string }> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only the organization Owner can delete this workspace"
    );
  }

  // Check if there are other active team members in the workspace
  const otherActiveMembersCount = await db.membership.count({
    where: {
      organizationId: currentOrg.id,
      status: "active",
      userId: { not: userId },
    },
  });

  if (otherActiveMembersCount > 0) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "Cannot delete organization while active team members remain. Please remove all team members before deleting the workspace."
    );
  }

  await db.organization.update({
    where: { id: currentOrg.id },
    data: { deletedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      organizationId: currentOrg.id,
      actorUserId: userId,
      action: "organization.deleted",
      targetType: "organization",
      targetId: currentOrg.id,
      metadata: { deletedAt: new Date().toISOString() },
    },
  });

  return { message: "Organization deleted successfully" };
}

// ============================================================================
// MEMBERSHIP SERVICES
// ============================================================================

export async function getOrganizationMembers(
  userId: string,
  idOrSlug: string
): Promise<MemberSchema[]> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  const memberships = await db.membership.findMany({
    where: {
      organizationId: currentOrg.id,
      status: "active",
    },
    include: {
      user: true,
      role: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role.name,
    status: m.status,
    joinedAt: m.createdAt.toISOString(),
  }));
}

export async function updateMemberRole(
  userId: string,
  idOrSlug: string,
  memberId: string,
  data: UpdateMemberRoleSchema
): Promise<MemberSchema> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can manage team member roles"
    );
  }

  if (data.roleName === "Owner" && currentOrg.role !== "Owner") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only the workspace Owner can promote members to Owner"
    );
  }

  const targetMembership = await db.membership.findFirst({
    where: {
      id: memberId,
      organizationId: currentOrg.id,
    },
    include: {
      role: true,
    },
  });

  if (!targetMembership) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "Team member not found in this organization");
  }

  if (targetMembership.role.name === "Owner" && currentOrg.role !== "Owner") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Admins cannot modify the workspace Owner's role"
    );
  }

  if (targetMembership.userId === currentOrg.createdBy && data.roleName !== "Owner") {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "The creator of the organization must always remain an Owner. Transfer workspace ownership first before changing role."
    );
  }

  const targetRole = await getOrCreateSystemRole(data.roleName);

  const updatedMembership = await db.membership.update({
    where: { id: targetMembership.id },
    data: { roleId: targetRole.id },
    include: {
      user: true,
      role: true,
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: currentOrg.id,
      actorUserId: userId,
      action: "member.role_updated",
      targetType: "membership",
      targetId: updatedMembership.id,
      metadata: { oldRole: targetMembership.role.name, newRole: targetRole.name },
    },
  });

  return {
    id: updatedMembership.id,
    userId: updatedMembership.userId,
    name: updatedMembership.user.name,
    email: updatedMembership.user.email,
    avatarUrl: updatedMembership.user.avatarUrl,
    role: updatedMembership.role.name,
    status: updatedMembership.status,
    joinedAt: updatedMembership.createdAt.toISOString(),
  };
}

export async function removeMember(
  userId: string,
  idOrSlug: string,
  memberId: string
): Promise<{ message: string }> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  const targetMembership = await db.membership.findFirst({
    where: {
      id: memberId,
      organizationId: currentOrg.id,
    },
    include: {
      role: true,
    },
  });

  if (!targetMembership) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "Team member not found in this organization");
  }

  const isSelf = targetMembership.userId === userId;

  if (!isSelf && currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can remove team members"
    );
  }

  if (!isSelf && currentOrg.role === "Admin" && targetMembership.role.name === "Owner") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Admins cannot remove workspace Owners"
    );
  }

  if (targetMembership.userId === currentOrg.createdBy) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "The creator of the organization cannot leave or be removed. Workspace ownership must be transferred first."
    );
  }

  if (targetMembership.role.name === "Owner") {
    const ownerCount = await db.membership.count({
      where: {
        organizationId: currentOrg.id,
        role: { name: "Owner" },
        status: "active",
      },
    });

    if (ownerCount <= 1) {
      throw new AppError(
        HttpStatusCodes.BAD_REQUEST,
        "Cannot remove the workspace Owner when they are the sole owner. Transfer ownership first."
      );
    }
  }

  await db.membership.delete({
    where: { id: targetMembership.id },
  });

  await db.auditLog.create({
    data: {
      organizationId: currentOrg.id,
      actorUserId: userId,
      action: isSelf ? "member.left" : "member.removed",
      targetType: "membership",
      targetId: targetMembership.id,
      metadata: { targetUserId: targetMembership.userId, email: targetMembership.userId },
    },
  });

  return {
    message: isSelf
      ? "You have left the organization successfully"
      : "Member removed from organization successfully",
  };
}

// ============================================================================
// INVITATION SERVICES
// ============================================================================

export async function createInvitation(
  userId: string,
  idOrSlug: string,
  data: CreateInvitationSchema
): Promise<InvitationSchema> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can invite new team members"
    );
  }

  const targetEmail = data.email.toLowerCase().trim();

  // Check if target is already an active member
  const existingMember = await db.membership.findFirst({
    where: {
      organizationId: currentOrg.id,
      user: { email: targetEmail },
      status: "active",
    },
  });

  if (existingMember) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      `User '${targetEmail}' is already an active member of this organization`
    );
  }

  const targetRole = await getOrCreateSystemRole(data.roleName);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Delete any previous invitations for same email/org (pending, accepted, or cancelled)
  await db.invitation.deleteMany({
    where: {
      organizationId: currentOrg.id,
      email: targetEmail,
    },
  });

  const invitation = await db.invitation.create({
    data: {
      organizationId: currentOrg.id,
      email: targetEmail,
      roleId: targetRole.id,
      token,
      invitedBy: userId,
      status: "pending",
      expiresAt,
    },
    include: {
      organization: true,
      role: true,
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: currentOrg.id,
      actorUserId: userId,
      action: "invitation.created",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email: targetEmail, role: targetRole.name },
    },
  });

  const inviteUrl = `${env.FRONTEND_URL}/invitations/accept?token=${token}&email=${encodeURIComponent(targetEmail)}&org=${invitation.organization.slug}`;

  // Log magic link for development / SMTP integration
  console.log(`[INVITATION] Magic Link created for ${targetEmail}: ${inviteUrl}`);

  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    organizationName: invitation.organization.name,
    email: invitation.email,
    role: invitation.role.name,
    token: invitation.token,
    inviteUrl,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

export async function getOrganizationInvitations(
  userId: string,
  idOrSlug: string
): Promise<InvitationSchema[]> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can view pending invitations"
    );
  }

  const invitations = await db.invitation.findMany({
    where: {
      organizationId: currentOrg.id,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: true,
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return invitations.map((inv) => ({
    id: inv.id,
    organizationId: inv.organizationId,
    organizationName: inv.organization.name,
    email: inv.email,
    role: inv.role.name,
    token: inv.token,
    inviteUrl: `${env.FRONTEND_URL}/invitations/accept?token=${inv.token}&email=${encodeURIComponent(inv.email)}&org=${inv.organization.slug}`,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }));
}

export async function cancelInvitation(
  userId: string,
  idOrSlug: string,
  invitationId: string
): Promise<{ message: string }> {
  const currentOrg = await getOrganizationByIdOrSlug(userId, idOrSlug);

  if (currentOrg.role !== "Owner" && currentOrg.role !== "Admin") {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      "Only organization Owners and Admins can cancel invitations"
    );
  }

  const invitation = await db.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId: currentOrg.id,
    },
  });

  if (!invitation) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "Invitation not found");
  }

  await db.invitation.delete({
    where: { id: invitation.id },
  });

  await db.auditLog.create({
    data: {
      organizationId: currentOrg.id,
      actorUserId: userId,
      action: "invitation.cancelled",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email: invitation.email },
    },
  });

  return { message: "Invitation cancelled successfully" };
}

export async function acceptInvitation(
  userId: string,
  token: string
): Promise<{ message: string; organizationId: string }> {
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      organization: true,
      role: true,
    },
  });

  if (!invitation || invitation.status !== "pending") {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "Invalid or already used invitation token"
    );
  }

  if (invitation.expiresAt < new Date()) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "Invitation token has expired. Please ask your administrator to send a new invitation."
    );
  }

  // Verify that the caller's email matches the email assigned to the invitation
  const callerUser = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!callerUser || callerUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      HttpStatusCodes.FORBIDDEN,
      `You are not assigned to this invitation.`
    );
  }

  // Check if caller is already an ACTIVE member
  const existingMembership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: invitation.organizationId,
      },
    },
  });

  if (existingMembership && existingMembership.status === "active") {
    // Mark invitation accepted and return
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    return {
      message: "You are already an active member of this organization",
      organizationId: invitation.organizationId,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invitation.organizationId,
        },
      },
      create: {
        userId,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
        invitedBy: invitation.invitedBy,
        status: "active",
      },
      update: {
        roleId: invitation.roleId,
        invitedBy: invitation.invitedBy,
        status: "active",
      },
    });

    // Clean up any old invitation rows for this email in this org to prevent unique constraint collision on status='accepted'
    await tx.invitation.deleteMany({
      where: {
        organizationId: invitation.organizationId,
        email: invitation.email,
        id: { not: invitation.id },
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: invitation.organizationId,
        actorUserId: userId,
        action: "invitation.accepted",
        targetType: "invitation",
        targetId: invitation.id,
        metadata: { role: invitation.role.name },
      },
    });
  });

  return {
    message: `Successfully joined ${invitation.organization.name}!`,
    organizationId: invitation.organizationId,
  };
}
