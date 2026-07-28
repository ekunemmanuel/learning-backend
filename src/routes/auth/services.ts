import { prisma as db } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import {
  CreateAccountSchema,
  LoginSchema,
  LoginMfaSchema,
  VerifyOtpSchema,
  ResendOtpSchema,
  RefreshTokenSchema,
  LogoutSchema,
  ResetPasswordSchema,
  MfaSetupSchema,
  MfaVerifySchema,
  CreateApiTokenSchema,
} from "./schema";
import { generateOTP, hashText, generateRandomToken, normalizeCountryCode } from "./utils";

// Duration constants
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

type OtpTypeEnum = "email_verification" | "phone_verification" | "password_reset";

/**
 * Get an existing unexpired OTP for (identifier, type), or generate/replace if expired or non-existent.
 * Guarantees uniqueness per (identifier, type).
 */
export const getOrCreateOtp = async (
  identifier: string,
  type: OtpTypeEnum
): Promise<string> => {
  const existingOtp = await db.otp.findUnique({
    where: {
      identifier_type: {
        identifier,
        type,
      },
    },
  });

  if (existingOtp) {
    if (existingOtp.expiresAt > new Date()) {
      // Reuse unexpired OTP
      console.log(`[AUTH] Reusing valid OTP ${existingOtp.code} (${type}) for ${identifier}`);
      return existingOtp.code;
    }

    // Replace expired OTP
    const newCode = generateOTP(4);
    console.log(`[AUTH] Replacing expired OTP with ${newCode} (${type}) for ${identifier}`);
    await db.otp.update({
      where: { id: existingOtp.id },
      data: {
        code: newCode,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    return newCode;
  }

  // Create new unique OTP record
  const otpCode = generateOTP(4);
  console.log(`[AUTH] Created new OTP ${otpCode} (${type}) for ${identifier}`);
  await db.otp.create({
    data: {
      identifier,
      code: otpCode,
      type,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  return otpCode;
};

export const createAccount = async (data: CreateAccountSchema) => {
  // Check for duplicate email, username, or phone
  const existingEmail = await db.user.findUnique({
    where: { email: data.email },
  });
  if (existingEmail) {
    throw new AppError(HttpStatusCodes.BAD_REQUEST, "An account with this email already exists");
  }

  if (data.username) {
    const existingUsername = await db.user.findUnique({
      where: { username: data.username },
    });
    if (existingUsername) {
      throw new AppError(HttpStatusCodes.BAD_REQUEST, "Username is already taken");
    }
  }

  if (data.phone) {
    const existingPhone = await db.user.findUnique({
      where: { phone: data.phone },
    });
    if (existingPhone) {
      throw new AppError(HttpStatusCodes.BAD_REQUEST, "Phone number is already in use");
    }
  }

  const passwordHash = await hashText(data.password);
  const normalizedCountry = normalizeCountryCode(data.country);

  const user = await db.user.create({
    data: {
      email: data.email,
      username: data.username,
      phone: data.phone,
      country: normalizedCountry,
      name: data.name,
      passwordHash,
      avatarUrl: data.avatarUrl,
    },
  });

  // Write audit log
  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "user.created",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email, username: user.username },
    },
  });

  const otpCode = await getOrCreateOtp(data.email, "email_verification");
  console.log(`[AUTH] Sent verification OTP ${otpCode} to ${data.email}`);

  return {
    message: "Account created successfully. An OTP has been sent for verification",
  };
};

export const verifyOtp = async (data: VerifyOtpSchema) => {
  const { identifier, code, type } = data;

  // Resolve user target by email, phone, or username
  const targetUser = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
        { username: identifier },
      ],
    },
  });

  const targetIdentifier = targetUser?.email || identifier;

  const otp = await db.otp.findUnique({
    where: {
      identifier_type: {
        identifier: targetIdentifier,
        type: type as OtpTypeEnum,
      },
    },
  });

  if (!otp || otp.code !== code) {
    throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid verification code");
  }

  if (otp.expiresAt < new Date()) {
    const newOtpCode = await getOrCreateOtp(targetIdentifier, type as OtpTypeEnum);
    console.log(`[AUTH] Resending expired OTP ${newOtpCode} to ${targetIdentifier}`);

    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "OTP has expired. A new verification code has been sent"
    );
  }

  // Handle password reset OTP verification without deleting yet!
  if (type === "password_reset") {
    return {
      message: "Password reset OTP verified successfully. You may now reset your password.",
    };
  }

  // Account verification handling
  if (targetUser) {
    if (type === "email_verification") {
      await db.user.update({
        where: { id: targetUser.id },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });
      await db.auditLog.create({
        data: {
          actorUserId: targetUser.id,
          action: "user.email_verified",
          targetType: "user",
          targetId: targetUser.id,
        },
      });
    } else if (type === "phone_verification") {
      await db.user.update({
        where: { id: targetUser.id },
        data: { isPhoneVerified: true, phoneVerifiedAt: new Date() },
      });
      await db.auditLog.create({
        data: {
          actorUserId: targetUser.id,
          action: "user.phone_verified",
          targetType: "user",
          targetId: targetUser.id,
        },
      });
    }
  }

  // Delete verified email/phone OTP record
  await db.otp.delete({
    where: { id: otp.id },
  });

  return {
    message: "Account verified successfully",
  };
};

export const resendOtp = async (data: ResendOtpSchema) => {
  const { identifier, purpose } = data;

  // Resolve target by email, phone, or username
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
        { username: identifier },
      ],
    },
  });

  const targetIdentifier = user?.email || identifier;

  if (user || purpose === "password_reset") {
    const otpCode = await getOrCreateOtp(targetIdentifier, purpose as OtpTypeEnum);
    console.log(`[AUTH] Resent OTP ${otpCode} for ${purpose} to ${targetIdentifier}`);
  }

  return {
    message: "An OTP has been sent to your registered contact channel",
  };
};

export const login = async (
  data: LoginSchema,
  clientInfo?: { ip?: string; userAgent?: string }
) => {
  const { identifier, password, mfaCode } = data;

  // Multi-identifier resolution: match by email OR phone OR username
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
        { username: identifier },
      ],
    },
    include: { mfaMethods: { where: { isVerified: true } } },
  });

  const inputPasswordHash = await hashText(password);

  if (!user || !user.passwordHash || user.passwordHash !== inputPasswordHash) {
    await db.loginAttempt.create({
      data: {
        email: identifier,
        userId: user?.id,
        ipAddress: clientInfo?.ip,
        userAgent: clientInfo?.userAgent,
        success: false,
        failureReason: "invalid_credentials",
      },
    });

    throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid credentials");
  }

  if (user.deletedAt) {
    throw new AppError(HttpStatusCodes.FORBIDDEN, "Account has been deactivated");
  }

  // Check 2FA requirement if user has active verified MFA methods
  if (user.mfaMethods.length > 0) {
    // If no MFA code is supplied in step 1, notify the frontend to prompt for MFA code!
    if (!mfaCode) {
      return {
        message: "Multi-Factor Authentication required",
        mfaRequired: true,
        user: null,
        refreshToken: null,
      };
    }

    // Verify MFA code directly if supplied in body
    let isMfaValid = user.mfaMethods.some((method) => {
      try {
        return verifySync({ token: mfaCode, secret: method.secretEncrypted || "" }).valid;
      } catch {
        return false;
      }
    });

    if (!isMfaValid) {
      const backupCodes = await db.userMfaBackupCode.findMany({
        where: { userId: user.id, usedAt: null },
      });

      for (const backupRecord of backupCodes) {
        const inputHash = await hashText(mfaCode);
        if (backupRecord.codeHash === inputHash) {
          isMfaValid = true;
          await db.userMfaBackupCode.update({
            where: { id: backupRecord.id },
            data: { usedAt: new Date() },
          });
          break;
        }
      }
    }

    if (!isMfaValid) {
      await db.loginAttempt.create({
        data: {
          email: user.email,
          userId: user.id,
          ipAddress: clientInfo?.ip,
          userAgent: clientInfo?.userAgent,
          success: false,
          failureReason: "mfa_failed",
        },
      });

      throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid MFA verification code");
    }
  }

  // Record successful login audit
  await db.loginAttempt.create({
    data: {
      email: user.email,
      userId: user.id,
      ipAddress: clientInfo?.ip,
      userAgent: clientInfo?.userAgent,
      success: true,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "user.login",
      targetType: "session",
      metadata: { ip: clientInfo?.ip, userAgent: clientInfo?.userAgent },
    },
  });

  // Generate Session & Refresh Token
  const rawRefreshToken = generateRandomToken(32);
  const tokenHash = await hashText(rawRefreshToken);

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash,
      ipAddress: clientInfo?.ip,
      userAgent: clientInfo?.userAgent,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    },
  });

  return {
    message: "Login successful",
    mfaRequired: false,
    user: {
      email: user.email,
      name: user.name,
    },
    refreshToken: rawRefreshToken,
  };
};

export const loginWithMfa = async (
  data: LoginMfaSchema,
  clientInfo?: { ip?: string; userAgent?: string }
) => {
  return login(
    {
      identifier: data.identifier,
      password: data.password,
      mfaCode: data.mfaCode,
    },
    clientInfo
  );
};

export const getMe = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "User profile not found");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    phone: user.phone,
    country: user.country,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    isPhoneVerified: user.isPhoneVerified,
    phoneVerifiedAt: user.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
  };
};

export const refreshSession = async (data: RefreshTokenSchema) => {
  if (!data.refreshToken) {
    throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Refresh token is required");
  }

  const tokenHash = await hashText(data.refreshToken);

  const existingSession = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingSession || existingSession.revokedAt || existingSession.expiresAt < new Date()) {
    throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  // Revoke old session
  await db.session.update({
    where: { id: existingSession.id },
    data: { revokedAt: new Date() },
  });

  // Issue rotated refresh token
  const newRawRefreshToken = generateRandomToken(32);
  const newTokenHash = await hashText(newRawRefreshToken);

  await db.session.create({
    data: {
      userId: existingSession.userId,
      tokenHash: newTokenHash,
      ipAddress: existingSession.ipAddress,
      userAgent: existingSession.userAgent,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: existingSession.userId,
      action: "user.session_refreshed",
      targetType: "session",
    },
  });

  return {
    message: "Session refreshed successfully",
    refreshToken: newRawRefreshToken,
  };
};

export const logout = async (data: LogoutSchema) => {
  if (!data.refreshToken) {
    return { message: "Logged out successfully" };
  }

  const tokenHash = await hashText(data.refreshToken);

  const session = await db.session.findUnique({
    where: { tokenHash },
  });

  if (session && !session.revokedAt) {
    await db.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "user.logout",
        targetType: "session",
      },
    });
  }

  return {
    message: "Logged out successfully",
  };
};

export const resetPassword = async (data: ResetPasswordSchema) => {
  const { identifier, code, newPassword } = data;

  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
        { username: identifier },
      ],
    },
  });

  const targetIdentifier = user?.email || identifier;

  const otp = await db.otp.findUnique({
    where: {
      identifier_type: {
        identifier: targetIdentifier,
        type: "password_reset",
      },
    },
  });

  if (!otp || otp.code !== code || otp.expiresAt < new Date()) {
    throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid or expired password reset OTP");
  }

  if (!user) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "User account not found");
  }

  const newPasswordHash = await hashText(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Revoke all active sessions upon password reset
  await db.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "user.password_reset",
      targetType: "user",
      targetId: user.id,
    },
  });

  // Delete password_reset OTP after successful password change!
  await db.otp.delete({
    where: { id: otp.id },
  });

  return {
    message: "Password reset successfully. Please log in with your new password",
  };
};

export const setupMfa = async (userId: string, data: MfaSetupSchema) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "User account not found for MFA setup");
  }

  const accountName = user.email || user.username || userId;

  // Generate Base32 secret compatible with Google & Microsoft Authenticator
  const secret = generateSecret();
  const otpauth = generateURI({
    secret,
    label: accountName,
    issuer: "LearningBackend",
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  const mfaMethod = await db.userMfaMethod.upsert({
    where: {
      userId_type: {
        userId,
        type: data.type,
      },
    },
    update: {
      secretEncrypted: secret,
      isVerified: false,
    },
    create: {
      userId,
      type: data.type,
      name: data.name,
      secretEncrypted: secret,
      isVerified: false,
    },
  });

  return {
    message: "MFA setup initiated",
    methodId: mfaMethod.id,
    secret,
    qrCodePayload: otpauth,
    qrCodeDataUrl,
  };
};

export const verifyMfa = async (userId: string, data: MfaVerifySchema) => {
  const mfaMethod = await db.userMfaMethod.findFirst({
    where: { id: data.methodId, userId },
  });

  if (!mfaMethod) {
    throw new AppError(HttpStatusCodes.NOT_FOUND, "MFA setup method not found");
  }

  // Real RFC 6238 TOTP verification
  let isValid = false;
  try {
    isValid = verifySync({
      token: data.code,
      secret: mfaMethod.secretEncrypted || "",
    }).valid;
  } catch {
    isValid = false;
  }

  if (!isValid) {
    throw new AppError(
      HttpStatusCodes.BAD_REQUEST,
      "Invalid TOTP code. Please check your Authenticator app time and enter the 6-digit code again."
    );
  }

  await db.userMfaMethod.update({
    where: { id: mfaMethod.id },
    data: {
      isVerified: true,
      lastUsedAt: new Date(),
    },
  });

  // Clear existing backup codes before generating new set of 10
  await db.userMfaBackupCode.deleteMany({
    where: { userId },
  });

  // Generate 10 emergency backup codes
  const rawBackupCodes: string[] = [];
  const backupCodeRecords = [];

  for (let i = 0; i < 10; i++) {
    const code = generateRandomToken(8);
    rawBackupCodes.push(code);
    const codeHash = await hashText(code);
    backupCodeRecords.push({
      userId,
      codeHash,
    });
  }

  await db.userMfaBackupCode.createMany({
    data: backupCodeRecords,
  });

  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "mfa.enabled",
      targetType: "mfa_method",
      targetId: mfaMethod.id,
    },
  });

  return {
    message: "MFA enabled successfully",
    backupCodes: rawBackupCodes,
  };
};

export const createApiToken = async (userId: string, data: CreateApiTokenSchema) => {
  const rawToken = `sk_live_${generateRandomToken(32)}`;
  const tokenHash = await hashText(rawToken);

  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiToken = await db.apiToken.create({
    data: {
      userId,
      name: data.name,
      tokenHash,
      scopes: data.scopes,
      expiresAt,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "api_token.created",
      targetType: "api_token",
      targetId: apiToken.id,
    },
  });

  return {
    message: "API Token created successfully",
    id: apiToken.id,
    name: apiToken.name,
    scopes: apiToken.scopes,
    apiToken: rawToken,
  };
};