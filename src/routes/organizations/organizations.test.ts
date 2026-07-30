import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testClient } from "hono/testing";
import app from "@/app";
import { prisma } from "@/lib/prisma";

const client = testClient(app) as any;

describe("organizations, memberships, and invitations routes", () => {
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let createdOrgId: string;
  let createdOrgSlug: string;
  let invitationToken: string;
  let invitationId: string;
  let user2MembershipId: string;

  beforeAll(async () => {
    // Clean database tables before running tests
    await prisma.auditLog.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userMfaMethod.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create User 1 (Owner)
    const signup1Res = await client.auth.signup.$post({
      json: {
        name: "Alice Owner",
        email: "alice@example.com",
        password: "password123",
        username: "aliceowner",
      },
    });
    expect(signup1Res.status).toBe(201);

    const dbUser1 = await prisma.user.findFirst({ where: { email: "alice@example.com" } });
    user1Id = dbUser1!.id;

    const login1Res = await client.auth.login.$post({
      json: { identifier: "alice@example.com", password: "password123" },
    });
    const login1Json: any = await login1Res.json();
    user1Token = login1Json.data.refreshToken;

    // 2. Create User 2 (Invited Member)
    const signup2Res = await client.auth.signup.$post({
      json: {
        name: "Bob Teammate",
        email: "bob@example.com",
        password: "password123",
        username: "bobteammate",
      },
    });
    expect(signup2Res.status).toBe(201);

    const dbUser2 = await prisma.user.findFirst({ where: { email: "bob@example.com" } });
    user2Id = dbUser2!.id;

    const login2Res = await client.auth.login.$post({
      json: { identifier: "bob@example.com", password: "password123" },
    });
    const login2Json: any = await login2Res.json();
    user2Token = login2Json.data.refreshToken;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userMfaMethod.deleteMany();
    await prisma.user.deleteMany();
  });

  it("post /organizations creates organization workspace", async () => {
    const res = await client.organizations.$post(
      {
        json: {
          name: "Starlight SaaS",
          slug: "starlight-saas",
          billingPlan: "pro",
        },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.name).toBe("Starlight SaaS");
    expect(json.data.role).toBe("Owner");

    createdOrgId = json.data.id;
    createdOrgSlug = json.data.slug;
  });

  it("get /organizations/:idOrSlug/members returns workspace members", async () => {
    const res = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].email).toBe("alice@example.com");
    expect(json.data[0].role).toBe("Owner");
  });

  it("post /organizations/:idOrSlug/invitations creates invitation token", async () => {
    const res = await client.organizations[":idOrSlug"]["invitations"].$post(
      {
        param: { idOrSlug: createdOrgSlug },
        json: {
          email: "bob@example.com",
          roleName: "Member",
        },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.token).toBeDefined();
    expect(json.data.email).toBe("bob@example.com");

    invitationToken = json.data.token;
    invitationId = json.data.id;
  });

  it("get /organizations/:idOrSlug/invitations lists pending invitations", async () => {
    const res = await client.organizations[":idOrSlug"]["invitations"].$get(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].token).toBe(invitationToken);
  });

  it("post /organizations/invitations/accept rejects when caller email does not match invitation email", async () => {
    // User 1 (alice@example.com) attempts to accept invitation sent to bob@example.com
    const res = await client.organizations["invitations"]["accept"].$post(
      {
        json: { token: invitationToken },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(403);
  });

  it("post /organizations/invitations/accept accepts invitation for User 2", async () => {
    const res = await client.organizations["invitations"]["accept"].$post(
      {
        json: { token: invitationToken },
      },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    // Verify Bob is now an active member
    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const membersJson: any = await membersRes.json();
    expect(membersJson.data.length).toBe(2);

    const bobMember = membersJson.data.find((m: any) => m.email === "bob@example.com");
    expect(bobMember).toBeDefined();
    expect(bobMember.role).toBe("Member");
    user2MembershipId = bobMember.id;
  });

  it("patch /organizations/:idOrSlug/members/:memberId promotes User 2 to Admin", async () => {
    const res = await client.organizations[":idOrSlug"]["members"][":memberId"].$patch(
      {
        param: { idOrSlug: createdOrgSlug, memberId: user2MembershipId },
        json: { roleName: "Admin" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.role).toBe("Admin");
  });

  it("delete /organizations/:idOrSlug blocks deletion while active team members remain", async () => {
    // Attempt deletion while User 2 (Bob) is still in the organization
    const res = await client.organizations[":idOrSlug"].$delete(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.message).toContain("Cannot delete organization while active team members remain");
  });

  it("delete /organizations/:idOrSlug/members/:memberId removes member from workspace", async () => {
    const res = await client.organizations[":idOrSlug"]["members"][":memberId"].$delete(
      {
        param: { idOrSlug: createdOrgSlug, memberId: user2MembershipId },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(200);

    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const membersJson: any = await membersRes.json();
    expect(membersJson.data.length).toBe(1);
  });

  it("delete /organizations/:idOrSlug soft-deletes organization after all members are removed", async () => {
    const res = await client.organizations[":idOrSlug"].$delete(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    // Verify retrieval now returns 404
    const getRes = await client.organizations[":idOrSlug"].$get(
      { param: { idOrSlug: createdOrgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    expect(getRes.status).toBe(404);
  });

  it("delete /organizations/:idOrSlug/invitations/:invitationId revokes invitation", async () => {
    // Create new organization to test invitation cancellation
    const newOrgRes = await client.organizations.$post(
      {
        json: { name: "Temp Invites Org" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const newOrgJson: any = await newOrgRes.json();
    const tempOrgSlug = newOrgJson.data.slug;

    const createRes = await client.organizations[":idOrSlug"]["invitations"].$post(
      {
        param: { idOrSlug: tempOrgSlug },
        json: { email: "charlie@example.com", roleName: "Member" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const createJson: any = await createRes.json();
    const charlieInviteId = createJson.data.id;

    const cancelRes = await client.organizations[":idOrSlug"]["invitations"][":invitationId"].$delete(
      {
        param: { idOrSlug: tempOrgSlug, invitationId: charlieInviteId },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(cancelRes.status).toBe(200);
  });

  it("delete /organizations/:idOrSlug/members/:memberId prevents removing workspace creator", async () => {
    // Create temp organization to test creator protection
    const tempRes = await client.organizations.$post(
      {
        json: { name: "Creator Safeguard Org" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const tempJson: any = await tempRes.json();
    const tempSlug = tempJson.data.slug;

    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: tempSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const membersJson: any = await membersRes.json();
    const aliceMember = membersJson.data.find((m: any) => m.email === "alice@example.com");

    const deleteRes = await client.organizations[":idOrSlug"]["members"][":memberId"].$delete(
      {
        param: { idOrSlug: tempSlug, memberId: aliceMember.id },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(deleteRes.status).toBe(400);
  });

  it("patch /organizations/:idOrSlug/members/:memberId prevents demoting workspace creator", async () => {
    // Create temp organization to test creator demotion protection
    const tempRes = await client.organizations.$post(
      {
        json: { name: "Creator Demotion Safeguard Org" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const tempJson: any = await tempRes.json();
    const tempSlug = tempJson.data.slug;

    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: tempSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const membersJson: any = await membersRes.json();
    const aliceMember = membersJson.data.find((m: any) => m.email === "alice@example.com");

    const patchRes = await client.organizations[":idOrSlug"]["members"][":memberId"].$patch(
      {
        param: { idOrSlug: tempSlug, memberId: aliceMember.id },
        json: { roleName: "Member" },
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    expect(patchRes.status).toBe(400);
  });

  it("post /organizations/invitations/accept allows re-inviting and re-joining a previously removed member", async () => {
    // 1. Create org
    const orgRes = await client.organizations.$post(
      { json: { name: "Re-invite Test Org" } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const orgJson: any = await orgRes.json();
    const orgSlug = orgJson.data.slug;

    // 2. Invite Bob
    const inviteRes1 = await client.organizations[":idOrSlug"]["invitations"].$post(
      { param: { idOrSlug: orgSlug }, json: { email: "bob@example.com", roleName: "Member" } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const inviteJson1: any = await inviteRes1.json();

    // 3. Bob accepts
    await client.organizations["invitations"]["accept"].$post(
      { json: { token: inviteJson1.data.token } },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    // 4. User 1 removes Bob
    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: orgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const membersJson: any = await membersRes.json();
    const bobMember = membersJson.data.find((m: any) => m.email === "bob@example.com");

    await client.organizations[":idOrSlug"]["members"][":memberId"].$delete(
      { param: { idOrSlug: orgSlug, memberId: bobMember.id } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    // 5. Re-invite Bob
    const inviteRes2 = await client.organizations[":idOrSlug"]["invitations"].$post(
      { param: { idOrSlug: orgSlug }, json: { email: "bob@example.com", roleName: "Admin" } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const inviteJson2: any = await inviteRes2.json();

    // 6. Bob accepts second invitation
    const acceptRes2 = await client.organizations["invitations"]["accept"].$post(
      { json: { token: inviteJson2.data.token } },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(acceptRes2.status).toBe(200);

    // Verify Bob is back in the org with Admin role
    const finalMembersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: orgSlug } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const finalMembersJson: any = await finalMembersRes.json();
    const readdedBob = finalMembersJson.data.find((m: any) => m.email === "bob@example.com");
    expect(readdedBob).toBeDefined();
    expect(readdedBob.role).toBe("Admin");
  });

  it("delete /organizations/:idOrSlug/members/:memberId rejects when caller is a regular Member", async () => {
    // 1. Create org
    const orgRes = await client.organizations.$post(
      { json: { name: "Member Self Delete Rejection Org" } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const orgJson: any = await orgRes.json();
    const orgSlug = orgJson.data.slug;

    // 2. Invite Bob as regular Member
    const inviteRes = await client.organizations[":idOrSlug"]["invitations"].$post(
      { param: { idOrSlug: orgSlug }, json: { email: "bob@example.com", roleName: "Member" } },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const inviteJson: any = await inviteRes.json();

    // 3. Bob accepts
    await client.organizations["invitations"]["accept"].$post(
      { json: { token: inviteJson.data.token } },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    // 4. Bob tries to delete himself
    const membersRes = await client.organizations[":idOrSlug"]["members"].$get(
      { param: { idOrSlug: orgSlug } },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );
    const membersJson: any = await membersRes.json();
    const bobMember = membersJson.data.find((m: any) => m.email === "bob@example.com");

    const deleteRes = await client.organizations[":idOrSlug"]["members"][":memberId"].$delete(
      { param: { idOrSlug: orgSlug, memberId: bobMember.id } },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    expect(deleteRes.status).toBe(403);
  });
});
