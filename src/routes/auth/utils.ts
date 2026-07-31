import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };

countries.registerLocale(enLocale);

export function generateOTP(length = 4): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, n => n % 10).join("");
}

export async function hashOtp(
  otp: string,
  verificationId: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${verificationId}:${otp}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateRandomToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function generateBackupCode(): string {
  // Use non-ambiguous uppercase alphanumeric characters (no 0/O, 1/I/L)
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);

  const codeChars = Array.from(array, byte => charset[byte % charset.length]);
  return `${codeChars.slice(0, 4).join("")}${codeChars.slice(4, 8).join("")}`;
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function normalizeCountryCode(input?: string | null): string | null {
  if (!input || typeof input !== "string")
    return null;
  const trimmed = input.trim();
  if (!trimmed)
    return null;

  // Check if already a valid 2-letter alpha-2 code
  if (trimmed.length === 2 && countries.isValid(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  // Convert full name or 3-letter code to 2-letter alpha-2 code
  const alpha2 = countries.getAlpha2Code(trimmed, "en");
  if (alpha2) {
    return alpha2.toUpperCase();
  }

  return null;
}
