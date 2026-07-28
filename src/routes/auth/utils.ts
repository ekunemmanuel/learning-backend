export function generateOTP(length = 4): string {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);

    return Array.from(array, n => n % 10).join("");
}

export async function hashOtp(
    otp: string,
    verificationId: string
): Promise<string> {
    const encoder = new TextEncoder();

    const data = encoder.encode(`${verificationId}:${otp}`);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}