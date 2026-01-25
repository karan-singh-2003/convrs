'use server'
import { flattenValidationErrors } from "next-safe-action";
import { requestPasswordResetSchema } from "../zod/schemas/auth";
import { actionClient } from "./safe-action";
import { prisma } from "@repo/db";
import { randomBytes } from "crypto";
import { sendEmail } from "@repo/email";
import ResetPasswordLink from "@repo/email/templates/reset-password-link";

const PASSWORD_RESET_TOKEN_EXPIRATION_MS = 60 * 60; // 1 hour

export const requestPasswordResetAction = actionClient
  .inputSchema(requestPasswordResetSchema, {
    handleValidationErrorsShape: async (ve) => {
      flattenValidationErrors(ve);
    },
  })
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString("hex");

    await prisma.$transaction([
      // remove old password reset tokens for this user
      prisma.passwordResetToken.deleteMany({
        where: {
          identifier: user.id,
        },
      }),

      prisma.passwordResetToken.create({
        data: {
          identifier: user.id,
          token,
          expires: new Date(
            Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION_MS * 1000
          ), // 1 hour from now
        },
      }),
    ]);

    await sendEmail({
      to: email,
      subject: `${process.env.NEXT_PUBLIC_APP_NAME} Password Reset Request`,
      react: ResetPasswordLink({
        email,
        url: `${process.env.NEXTAUTH_URL}/auth/reset-password/${token}`,
      }),
    });

    return {
      ok: true,
    };
  });
