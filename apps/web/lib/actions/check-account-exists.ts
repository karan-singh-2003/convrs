"use server";

import { prisma } from "@repo/db";
import { flattenValidationErrors } from "next-safe-action";
import * as z from "zod";
import { emailSchema } from "../zod/schemas/auth";
import { actionClient } from "./safe-action";

const schema = z.object({
  email: emailSchema,
});

export const checkAccountExistsAction = actionClient
  .inputSchema(schema, {
    handleValidationErrorsShape: async (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    const accountExists = !!user;
    const hasPassword = !!user?.passwordHash;

    // Check if SAML is required (placeholder - implement based on your requirements)
    const requireSAML = false;

    return {
      accountExists,
      hasPassword,
      requireSAML,
    };
  });
