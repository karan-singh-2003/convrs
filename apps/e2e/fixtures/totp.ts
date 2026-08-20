import * as OTPAuth from "otpauth";

/**
 * Computes a valid 6-digit TOTP code for a raw base32 secret, using the same
 * library (otpauth) and parameters the app itself uses to generate/validate
 * codes (apps/web/lib/auth/totp.ts). Used to drive real 2FA enable/login
 * flows through the UI without needing a real authenticator app.
 */
export function currentTotpCode(base32Secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Boilercode",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: base32Secret,
  });
  return totp.generate();
}

/** A syntactically valid but guaranteed-wrong 6-digit code. */
export function wrongTotpCode(correct: string): string {
  const asNumber = Number(correct);
  const wrong = (asNumber + 1) % 1_000_000;
  return String(wrong).padStart(6, "0");
}
