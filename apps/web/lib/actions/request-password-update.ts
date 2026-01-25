"use server";
import { actionClient } from "./safe-action";
import { resetPasswordSchema } from "../zod/schemas/auth";
import { flattenValidationErrors } from "next-safe-action";
import { prisma } from "@repo/db";
import { hashPassword, validatePassword } from "../auth/password";
import { waitUntil } from "@vercel/functions";
import { sendEmail } from "@repo/email";
import PasswordUpdated from "@repo/email/templates/password-updated";
import { NextResponse } from "next/server";

export const PasswordResetRequestAction = actionClient
  .inputSchema(resetPasswordSchema, {
    handleValidationErrorsShape: async (ve) => {
      flattenValidationErrors(ve);
    },
  })
  .action(async ({ parsedInput }) => {
    const { token, password } = parsedInput;

    const tokenFound = await prisma.passwordResetToken.findUnique({
      where: { token, expires: { gte: new Date() } },
      select: {
        identifier: true,
      },
    });

    if (!tokenFound) {
      throw new Error("Invalid or expired token");
    }

    const { identifier } = tokenFound;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: identifier },
      select: {
        emailVerified: true,
        passwordHash: true,
      },
    });

    if (user.passwordHash === password) {
      const isSamePassword = await validatePassword(
        password,
        user.passwordHash
      );
      if (isSamePassword) {
        throw new Error("New password must be different from the old password");
      }
    }

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: {
          token,
        },
      }),

      prisma.user.update({
        where: { email: identifier },
        data: {
          passwordHash: await hashPassword(password),
          ...(!user.emailVerified && { emailVerified: new Date() }),
        },
      }),
    ]);

    waitUntil(
      sendEmail({
        to: identifier,
        subject: `${process.env.NEXT_PUBLIC_APP_NAME} Password Successfully Reset`,
        react: PasswordUpdated({
          email: identifier,
          verb: "reset",
        }),
      })
    );

    return NextResponse.json({ ok: true });
  });
