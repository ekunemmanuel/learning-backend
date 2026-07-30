import { z } from "@hono/zod-openapi";

// Slug validation regex: lowercase letters, numbers, hyphens only
const slugRegex = /^[a-z0-9-]+$/;

// ============================================================================
// REQUEST & PARAM SCHEMAS
// ============================================================================

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50)
    .regex(slugRegex, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  billingPlan: z.enum(["free", "pro", "enterprise"]).default("free"),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  billingPlan: z.enum(["free", "pro", "enterprise"]).optional(),
});

export const organizationParamSchema = z.object({
  idOrSlug: z.string().min(1, "Organization ID or slug is required"),
});

export const memberParamSchema = z.object({
  idOrSlug: z.string().min(1),
  memberId: z.string().min(1, "Member ID is required"),
});

export const updateMemberRoleSchema = z.object({
  roleName: z.enum(["Owner", "Admin", "Member"]),
});

export const createInvitationSchema = z.object({
  email: z.string().email("Valid email address is required"),
  roleName: z.enum(["Admin", "Member"]).default("Member"),
});

export const invitationParamSchema = z.object({
  idOrSlug: z.string().min(1),
  invitationId: z.string().min(1, "Invitation ID is required"),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, "Valid invitation token is required"),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  billingPlan: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  memberCount: z.number().default(1),
  role: z.string().default("Owner"),
});

export const organizationListResponseSchema = z.array(organizationSchema);

export const organizationMessageResponseSchema = z.object({
  message: z.string(),
});

export const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  role: z.string(),
  status: z.string(),
  joinedAt: z.string(),
});

export const memberListResponseSchema = z.array(memberSchema);

export const invitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string().optional(),
  email: z.string(),
  role: z.string(),
  token: z.string(),
  inviteUrl: z.string().optional(),
  status: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const invitationListResponseSchema = z.array(invitationSchema);

// Types
export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
export type OrganizationParamSchema = z.infer<typeof organizationParamSchema>;
export type OrganizationSchema = z.infer<typeof organizationSchema>;
export type MemberParamSchema = z.infer<typeof memberParamSchema>;
export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>;
export type MemberSchema = z.infer<typeof memberSchema>;
export type CreateInvitationSchema = z.infer<typeof createInvitationSchema>;
export type InvitationParamSchema = z.infer<typeof invitationParamSchema>;
export type AcceptInvitationSchema = z.infer<typeof acceptInvitationSchema>;
export type InvitationSchema = z.infer<typeof invitationSchema>;
