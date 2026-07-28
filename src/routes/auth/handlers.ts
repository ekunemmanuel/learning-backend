import * as HttpStatusCodes from "stoker/http-status-codes";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { AppRouteHandler } from "@/lib/types";
import { prisma as db } from "@/lib/prisma";

import type {
  SignRoute,
  VerifyRoute,
  LoginRoute,
  LoginMfaRoute,
  GetMeRoute,
  ResendOtpRoute,
  RefreshRoute,
  LogoutRoute,
  ResetPasswordRoute,
  MfaSetupRoute,
  MfaVerifyRoute,
  MfaPageRoute,
  CreateApiTokenRoute,
} from "./routes";
import * as AuthService from "./services";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const signup: AppRouteHandler<SignRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.createAccount(data);
  return c.json(result, HttpStatusCodes.CREATED);
};

export const verify: AppRouteHandler<VerifyRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.verifyOtp(data);
  return c.json(result, HttpStatusCodes.OK);
};

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const data = c.req.valid("json");
  const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "127.0.0.1";
  const userAgent = c.req.header("user-agent") || undefined;

  const result = await AuthService.login(data, { ip, userAgent });

  // Set HTTP-Only refresh cookie only if authentication completed without MFA prompt
  if (result.refreshToken) {
    setCookie(c, REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return c.json(result, HttpStatusCodes.OK);
};

export const loginMfa: AppRouteHandler<LoginMfaRoute> = async (c) => {
  const data = c.req.valid("json");
  const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "127.0.0.1";
  const userAgent = c.req.header("user-agent") || undefined;

  const result = await AuthService.loginWithMfa(data, { ip, userAgent });

  if (result.refreshToken) {
    setCookie(c, REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return c.json(result, HttpStatusCodes.OK);
};

export const getMe: AppRouteHandler<GetMeRoute> = async (c) => {
  // userId is stamped by authMiddleware on this protected route
  const userId = c.get("userId");
  const result = await AuthService.getMe(userId);
  return c.json(result, HttpStatusCodes.OK);
};

export const resendOtp: AppRouteHandler<ResendOtpRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.resendOtp(data);
  return c.json(result, HttpStatusCodes.OK);
};

export const refresh: AppRouteHandler<RefreshRoute> = async (c) => {
  const data = c.req.valid("json");
  const tokenFromCookie = getCookie(c, REFRESH_TOKEN_COOKIE);
  const refreshToken = data.refreshToken || tokenFromCookie || "";

  const result = await AuthService.refreshSession({ refreshToken });

  // Set updated rotated HTTP-Only refresh token cookie
  setCookie(c, REFRESH_TOKEN_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return c.json(result, HttpStatusCodes.OK);
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  const data = c.req.valid("json");
  const tokenFromCookie = getCookie(c, REFRESH_TOKEN_COOKIE);
  const refreshToken = data.refreshToken || tokenFromCookie || "";

  const result = await AuthService.logout({ refreshToken });

  // Clear HTTP-Only refresh token cookie
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: "/" });

  return c.json(result, HttpStatusCodes.OK);
};

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.resetPassword(data);
  return c.json(result, HttpStatusCodes.OK);
};

export const mfaSetup: AppRouteHandler<MfaSetupRoute> = async (c) => {
  const data = c.req.valid("json");
  const userId = c.get("userId");
  const result = await AuthService.setupMfa(userId, data);
  return c.json(result, HttpStatusCodes.OK);
};

export const mfaVerify: AppRouteHandler<MfaVerifyRoute> = async (c) => {
  const data = c.req.valid("json");
  const userId = c.get("userId");
  const result = await AuthService.verifyMfa(userId, data);
  return c.json(result, HttpStatusCodes.OK);
};

export const mfaPage: AppRouteHandler<MfaPageRoute> = async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authenticator MFA Setup & Testing</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --accent: #38bdf8;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #4ade80;
      --danger: #f87171;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      padding: 2rem;
      margin: 0;
    }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
    }
    h1 { font-size: 1.5rem; color: var(--accent); margin-top: 0; }
    p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }
    button {
      background: var(--accent);
      color: #0f172a;
      border: none;
      font-weight: 600;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      font-size: 1rem;
      margin-top: 1rem;
    }
    button:hover { opacity: 0.9; }
    input {
      width: 100%;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0f172a;
      color: var(--text);
      margin-top: 0.5rem;
      box-sizing: border-box;
      font-size: 1rem;
    }
    .qr-container {
      text-align: center;
      margin: 1.5rem 0;
      padding: 1rem;
      background: #ffffff;
      border-radius: 12px;
    }
    .qr-container img { width: 200px; height: 200px; }
    .secret-box {
      background: #0f172a;
      padding: 0.75rem;
      border-radius: 8px;
      font-family: monospace;
      font-size: 1.1rem;
      letter-spacing: 2px;
      color: var(--accent);
      text-align: center;
      word-break: break-all;
      margin: 0.75rem 0;
    }
    .status { margin-top: 1rem; font-weight: 600; text-align: center; }
    .success { color: var(--success); }
    .error { color: var(--danger); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authenticator MFA Setup</h1>
    <p>Works with Google Authenticator, Microsoft Authenticator, 1Password, and Authy.</p>
    
    <button id="btnSetup" onclick="initiateSetup()">1. Generate QR Code & Secret Key</button>

    <div id="setupResult" style="display:none;">
      <p style="margin-top:1.5rem;">Scan this QR code with Google or Microsoft Authenticator:</p>
      <div class="qr-container">
        <img id="qrImg" src="" alt="QR Code">
      </div>

      <p>Or manually enter this Secret Key into your authenticator app:</p>
      <div class="secret-box" id="secretKey">---</div>

      <hr style="border:0; border-top:1px solid #334155; margin: 1.5rem 0;">

      <label>2. Enter 6-digit Code from your Authenticator App:</label>
      <input type="text" id="totpInput" placeholder="e.g. 123456" maxlength="6">
      <button onclick="verifyCode()">3. Verify & Activate MFA</button>
    </div>

    <div id="statusMessage" class="status"></div>
  </div>

  <script>
    let currentMethodId = "";

    async function initiateSetup() {
      const status = document.getElementById("statusMessage");
      status.innerText = "Generating secret...";
      try {
        const res = await fetch("/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "totp", name: "Authenticator App" })
        });
        const data = await res.json();
        if (data.success) {
          currentMethodId = data.data.methodId;
          document.getElementById("qrImg").src = data.data.qrCodeDataUrl;
          document.getElementById("secretKey").innerText = data.data.secret;
          document.getElementById("setupResult").style.display = "block";
          document.getElementById("btnSetup").style.display = "none";
          status.innerText = "";
        } else {
          status.className = "status error";
          status.innerText = data.message || "Failed to setup MFA";
        }
      } catch (err) {
        status.className = "status error";
        status.innerText = "Error connecting to server";
      }
    }

    async function verifyCode() {
      const code = document.getElementById("totpInput").value.trim();
      const status = document.getElementById("statusMessage");
      if (code.length !== 6) {
        status.className = "status error";
        status.innerText = "Please enter a 6-digit code";
        return;
      }

      status.innerText = "Verifying...";
      try {
        const res = await fetch("/auth/mfa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ methodId: currentMethodId, code: code })
        });
        const data = await res.json();
        if (data.success) {
          status.className = "status success";
          status.innerText = "✅ MFA Enabled Successfully! Emergency Backup Codes generated.";
        } else {
          status.className = "status error";
          status.innerText = "❌ " + (data.message || "Invalid TOTP code");
        }
      } catch (err) {
        status.className = "status error";
        status.innerText = "Error verifying code";
      }
    }
  </script>
</body>
</html>`;
  return c.html(html, HttpStatusCodes.OK);
};

export const createApiToken: AppRouteHandler<CreateApiTokenRoute> = async (c) => {
  const data = c.req.valid("json");
  const userId = c.get("userId");
  const result = await AuthService.createApiToken(userId, data);
  return c.json(result, HttpStatusCodes.CREATED);
};
