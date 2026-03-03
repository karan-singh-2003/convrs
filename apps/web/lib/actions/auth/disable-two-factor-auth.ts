"use server";

import { sendEmail } from "@repo/email";
import TwoFactorDisabled from "@repo/email/templates/two-factor-disabled";
import { prisma } from "@repo/db";
import { waitUntil } from "@vercel/functions";
import { authUserActionClient } from "../safe-action";

// Disable 2FA for an user
export const disableTwoFactorAuthAction = authUserActionClient.action(
  async ({ ctx }) => {
    const { user } = ctx;

    const currentUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    if (!currentUser.twoFactorConfirmedAt) {
      throw new Error("2FA is not enabled for your account.");
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorSecret: null,
        twoFactorConfirmedAt: null,
        twoFactorRecoveryCodes: null,
      },
    });

    waitUntil(
      sendEmail({
        subject: "Two Factor authentication disabled",
        to: user.email,
        react: TwoFactorDisabled({ email: user.email }),
        variant: "notifications",
      }),
    );
  },
);