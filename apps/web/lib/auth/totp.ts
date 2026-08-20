import * as OTPAuth from "otpauth";
import { decrypt } from "@repo/analytics";

// Secrets written before the plaintext-storage fix aren't encrypted yet;
// detect our encrypted format (iv:tag:ciphertext, all hex) and pass legacy
// plaintext base32 secrets through unchanged rather than failing to decrypt.
const ENCRYPTED_SECRET_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export function decryptTwoFactorSecret(stored: string): string {
  return ENCRYPTED_SECRET_PATTERN.test(stored) ? decrypt(stored) : stored;
}

const options = {
  issuer: "Boilercode",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
};

export const generateTOTPSecret = () => {
  const secret = new OTPAuth.Secret({
    size: 20, // 160 bits = 32 characters
  });

  return secret.base32;
};

export const getTOTPInstance = ({
  secret,
  label,
}: {
  secret: string;
  label?: string;
}) => {
  return new OTPAuth.TOTP({
    ...options,
    secret,
    label,
  });
};