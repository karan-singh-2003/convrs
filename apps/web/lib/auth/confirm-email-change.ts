import { prisma } from "@repo/db";
import { randomBytes } from "crypto";
import { hashToken } from "./hash-token";
import { redis } from "../upstash";
import { waitUntil } from "@vercel/functions";
import { sendEmail } from "@repo/email";
import ConfirmEmailChange from "@repo/email/templates/confirm-email-change";

export const confirmEmailChange = async ({
  email,
  newEmail,
  identifier,
  hostName,
}: {
  email: string;
  newEmail: string;
  identifier: string;
  hostName: string;
}) => {
  await prisma.verificationToken.deleteMany({
    where: {
      identifier,
    },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = 15 * 60 * 1000; // 15 minutes

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: await hashToken(token, { secret: true }),
      expires: new Date(Date.now() + expiresAt),
    },
  });

  await redis.set(
    `email-change-request:user:${identifier}`,
    {
      email,
      newEmail,
    },
    {
      px: expiresAt,
    }
  );

  waitUntil(
    sendEmail({
      subject: "Confirm your email change",
      to: newEmail,
      react: ConfirmEmailChange({
        email,
        newEmail,
        confirmUrl: `${hostName}/auth/confirm-email-change/${token}`,
      }),
    })
  );
};
