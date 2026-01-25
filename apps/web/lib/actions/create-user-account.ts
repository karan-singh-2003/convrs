"use server";

import { signUpSchema } from "../zod/schemas/auth";
import { actionClient } from "./safe-action";
import { flattenValidationErrors } from "next-safe-action";
import { prisma } from "@repo/db";
import * as z from "zod";
import { hashPassword } from "../auth/password";

const schema = signUpSchema.extend({
  code: z.string().min(6, "OTP must be 6 digits"),
});

export const createUserAccountAction = actionClient
  .inputSchema(schema, {
    handleValidationErrorsShape: async (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  .action(async ({ parsedInput }) => {
    const { email, password, code } = parsedInput;

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        identifier: email,
        token: code,
      },
    });

    if (!verificationToken) {
      throw new Error("Invalid or expired OTP code.");
    }

    if (
      verificationToken.expires &&
      verificationToken.expires < new Date()
    ) {
      throw new Error("OTP code has expired.");
    }

    await prisma.emailVerificationToken.delete({
      where: {
        identifier: email,
        token: code,
      },
    });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          emailVerified: new Date(),
        },
      });
    }
  });
