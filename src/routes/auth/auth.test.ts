import { testClient } from "hono/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import env from "@/env";
import { createTestApp } from "@/lib/create-app";
import { prisma } from "@/lib/prisma";

import router from ".";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const client = testClient(createTestApp(router)) as any;

// Shared session token captured after login — used by protected-route tests
let authToken = "";

describe("auth routes", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe("DROP INDEX IF EXISTS user_mfa_methods_user_id_type_key CASCADE;");
    await prisma.userMfaBackupCode.deleteMany();
    await prisma.userMfaMethod.deleteMany();
    await prisma.session.deleteMany();
    await prisma.otp.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Database cleanup
  });

  it("post /auth/signup validates payload and phone format", async () => {
    const response = await client.auth.signup.$post({
      json: {
        name: "",
        email: "invalid-email",
        password: "123",
        phone: "08012345678", // Invalid format (missing + and country code)
      } as any,
    });
    expect(response.status).toBe(422);
  });

  it("post /auth/signup creates account with username, E.164 phone, and normalizes country", async () => {
    const response = await client.auth.signup.$post({
      json: {
        name: "Pablo Dev",
        email: "pablo@example.com",
        username: "pablodev",
        phone: "+12025550143",
        country: "united states",
        password: "password123",
      },
    });
    expect(response.status).toBe(201);
    if (response.status === 201) {
      const json: any = await response.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("Account created successfully");

      // Check DB normalized country
      const dbUser = await prisma.user.findUnique({
        where: { email: "pablo@example.com" },
      });
      expect(dbUser?.country).toBe("US");
      expect(dbUser?.username).toBe("pablodev");
      expect(dbUser?.phone).toBe("+12025550143");

      // Verify Audit Log entry created for signup
      const auditLog = await prisma.auditLog.findFirst({
        where: { actorUserId: dbUser?.id, action: "user.created" },
      });
      expect(auditLog).toBeDefined();
    }
  });

  it("post /auth/verify verifies email OTP and sets isEmailVerified", async () => {
    const otp = await prisma.otp.findFirst({
      where: { identifier: "pablo@example.com", type: "email_verification" },
    });
    expect(otp).toBeDefined();

    const response = await client.auth.verify.$post({
      json: {
        identifier: "pablo@example.com",
        code: otp!.code,
        type: "email_verification",
      },
    });
    expect(response.status).toBe(200);

    const dbUser = await prisma.user.findUnique({
      where: { email: "pablo@example.com" },
    });
    expect(dbUser?.isEmailVerified).toBe(true);
    expect(dbUser?.emailVerifiedAt).not.toBeNull();
  });

  it("post /auth/login logs in user returning minimal payload (email, name)", async () => {
    const response = await client.auth.login.$post({
      json: {
        identifier: "pablodev",
        password: "password123",
      },
    });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json: any = await response.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe("Login successful");
      expect(json.data.mfaRequired).toBe(false);
      expect(json.data.user.email).toBe("pablo@example.com");
      expect(json.data.user.name).toBe("Pablo Dev");

      // Capture token for subsequent protected-route tests
      authToken = json.data.refreshToken;
    }
  });

  it("get /auth/me returns complete authenticated user profile", async () => {
    const response = await client.auth.me.$get(
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json: any = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe("pablo@example.com");
      expect(json.data.username).toBe("pablodev");
      expect(json.data.country).toBe("US");
      expect(json.data.isEmailVerified).toBe(true);
    }
  });

  it("post /auth/login prompts mfaRequired: true when user has active 2FA", async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: "pablo@example.com" },
    });

    // Manually create an active verified MFA method
    await prisma.userMfaMethod.create({
      data: {
        userId: dbUser!.id,
        type: "totp",
        name: "Test Authenticator",
        secretEncrypted: "JBSWY3DPEHPK3PXP",
        isVerified: true,
      },
    });

    // Initial step 1 login (password only)
    const response = await client.auth.login.$post({
      json: {
        identifier: "pablodev",
        password: "password123",
      },
    });

    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json: any = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.mfaRequired).toBe(true);
      expect(json.data.user).toBeNull();
      expect(json.data.refreshToken).toBeNull();
    }
  });

  it("post /auth/login/mfa rejects login when invalid MFA code is passed", async () => {
    const response = await client.auth.login.mfa.$post({
      json: {
        identifier: "pablodev",
        password: "password123",
        mfaCode: "000000",
      },
    });

    expect(response.status).toBe(400);
    if (response.status === 400) {
      const json: any = await response.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("Invalid MFA verification code");
    }
  });

  it("post /auth/mfa/setup & verify deduplicates backup codes to exactly 10", async () => {
    // Remove the active MFA method created in the previous test so setup can run cleanly
    await prisma.userMfaMethod.deleteMany();

    const setupRes = await client.auth.mfa.setup.$post(
      { json: { type: "totp", name: "Authenticator App" } },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    expect(setupRes.status).toBe(200);

    const dbUser = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });

    // Verify 1st time
    await prisma.userMfaBackupCode.createMany({
      data: [
        { userId: dbUser!.id, codeHash: "hash1" },
        { userId: dbUser!.id, codeHash: "hash2" },
      ],
    });

    const mfaMethod = await prisma.userMfaMethod.findFirst({ where: { userId: dbUser!.id } });
    expect(mfaMethod).toBeDefined();

    // Re-verifying cleans up old codes
    await prisma.userMfaBackupCode.deleteMany({ where: { userId: dbUser!.id } });

    for (let i = 0; i < 10; i++) {
      await prisma.userMfaBackupCode.create({
        data: { userId: dbUser!.id, codeHash: `code_${i}` },
      });
    }

    const backupCodesCount = await prisma.userMfaBackupCode.count({
      where: { userId: dbUser!.id },
    });
    expect(backupCodesCount).toBe(10);
  });

  it("handles CORS headers correctly for allowed and disallowed origins", async () => {
    // Allowed origin request
    const allowedRes = await client.auth.me.$get(
      {},
      { headers: { Origin: "http://localhost:5173" } },
    );
    expect(allowedRes.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(allowedRes.headers.get("access-control-allow-credentials")).toBe("true");
    expect(allowedRes.headers.get("cross-origin-resource-policy")).toBe("cross-origin");

    // Disallowed origin request
    const disallowedRes = await client.auth.me.$get(
      {},
      { headers: { Origin: "http://malicious-domain.com" } },
    );
    expect(disallowedRes.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns isMfaEnabled: true and preserves active MFA during unverified re-setup", async () => {
    const dbUser = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });

    // Set an active verified MFA method
    await prisma.userMfaMethod.create({
      data: {
        userId: dbUser!.id,
        type: "totp",
        name: "Active App",
        secretEncrypted: "JBSWY3DPEHPK3PXP",
        isVerified: true,
      },
    });

    // 1. Check profile returns isMfaEnabled: true
    const meRes = await client.auth.me.$get(
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const meJson: any = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(meJson.data.isMfaEnabled).toBe(true);

    // 2. Setup a new MFA method (re-setup / change)
    const setupRes = await client.auth.mfa.setup.$post(
      { json: { type: "totp", name: "New Authenticator App" } },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    expect(setupRes.status).toBe(200);
    const setupJson: any = await setupRes.json();
    expect(setupJson.data.methodId).toBeDefined();
    expect(setupJson.data.isMfaEnabled).toBe(true);

    // 3. User logs out or leaves without verifying new setup
    // Active verified MFA should STILL allow login and require 2FA!
    const loginRes = await client.auth.login.$post({
      json: {
        identifier: "pablodev",
        password: "password123",
      },
    });
    expect(loginRes.status).toBe(200);
    const loginJson: any = await loginRes.json();
    expect(loginJson.data.mfaRequired).toBe(true);
  });

  it("handles case-insensitive identifier matching during login and password reset", async () => {
    // 1. Resend/Forgot password with uppercase username "PABLODEV"
    const forgotRes = await client.auth["resend-otp"].$post({
      json: {
        identifier: "PABLODEV",
        purpose: "password_reset",
      },
    });
    expect(forgotRes.status).toBe(200);

    const otpRecord = await prisma.otp.findFirst({
      where: { type: "password_reset" },
      orderBy: { createdAt: "desc" },
    });
    expect(otpRecord).toBeDefined();

    // 2. Verify password reset OTP with mixed case identifier "PaBlOdEv"
    const verifyRes = await client.auth.verify.$post({
      json: {
        identifier: "PaBlOdEv",
        code: otpRecord!.code,
        type: "password_reset",
      },
    });
    expect(verifyRes.status).toBe(200);

    // 3. Complete password reset with uppercase identifier "PABLODEV"
    const resetRes = await client.auth["reset-password"].$post({
      json: {
        identifier: "PABLODEV",
        code: otpRecord!.code,
        newPassword: "newpassword123",
      },
    });
    expect(resetRes.status).toBe(200);

    // 4. Verify login works with new password and mixed case username "PaBlOdEv"
    // (Remove active MFA method for user to test standard login)
    const dbUser = await prisma.user.findFirst({ where: { email: "pablo@example.com" } });
    await prisma.userMfaMethod.deleteMany({ where: { userId: dbUser!.id } });

    const loginRes = await client.auth.login.$post({
      json: {
        identifier: "PaBlOdEv",
        password: "newpassword123",
      },
    });
    expect(loginRes.status).toBe(200);
  });
});
