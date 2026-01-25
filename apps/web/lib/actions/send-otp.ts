"use server";

import { sendEmail } from "@repo/email";
import VerifyEmail from "@repo/email/templates/verify-email"
import { prisma } from "@repo/db";
import { flattenValidationErrors } from "next-safe-action";
import * as z from "zod";
import { randomInt, createHash } from "crypto";
import { emailSchema, passwordSchema } from "../zod/schemas/auth";
import { actionClient } from "./safe-action";
import { isGenericEmail } from "../is-generic-email";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(),
});

// OTP expiry: 5 minutes
const OTP_EXPIRY_IN = 5 * 60;

// Generate 6-digit OTP
function generateOTP(): string {
  return randomInt(100000, 999999).toString();
}

export const sendOTPAction = actionClient
  .inputSchema(schema, {
    handleValidationErrorsShape: async (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    // Block "+" aliases for generic providers
    if (email.includes("+") && isGenericEmail(email)) {
      throw new Error(
        "Please use your primary email address without '+' for registration."
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      throw new Error(
        "User with this email already exists. Please log in instead."
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Remove old OTPs for this email
    await prisma.emailVerificationToken.deleteMany({
      where: { identifier: email },
    });

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Acme";

    await Promise.all([
      // Store OTP
      prisma.emailVerificationToken.create({
        data: {
          identifier: email,
          token: otp,
          expires: new Date(Date.now() + OTP_EXPIRY_IN * 1000),
        },
      }),

      // Send OTP email
      sendEmail({
        subject: `${appName}: Your verification code`,
        to: email,
        react: VerifyEmail({
          email,
          code: otp,
        }),
      }),
    ]);

    return {
      success: true,
      message: "OTP sent successfully",
    };
  });
