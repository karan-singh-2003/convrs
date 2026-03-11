import { withSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { updateUserSchema } from "@/lib/zod/schemas/user";
import { storage } from "@/lib/storage";
import { APP_DOMAIN, nanoid } from "@repo/utils";
import { prisma } from "@repo/db";
import { waitUntil } from "@vercel/functions";
import { R2_URL } from "@repo/utils";
import { confirmEmailChange } from "@/lib/auth/confirm-email-change";

// GET /api/user – get a specific user
export const GET = withSession(async ({ session }) => {
  const [user, account] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        defaultWorkspace: true,
        passwordHash: true,
        createdAt: true,
        twoFactorConfirmedAt: true,
        twoFactorRecoveryCodes: true,
      },
    }),

    prisma.account.findFirst({
      where: {
        userId: session.user.id,
      },
      select: {
        provider: true,
      },
    }),
  ]);

  return NextResponse.json({
    ...user,
    provider: account?.provider,
    hasPassword: user?.passwordHash !== null,
    passwordHash: undefined,
  });
});

export const PATCH = withSession(async ({ req, session }) => {
  let { name, email, image } = await updateUserSchema.parseAsync(
    await req.json()
  );

  if (image) {
    const { url } = await storage.upload({
      key: `avatars/${session.user.id}_${nanoid(7)}`,
      body: image,
    });
    image = url;
  }

  if (email && email !== session.user.email) {
    const userWithEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (userWithEmail) {
      return NextResponse.json(
        { error: "Email is already in use by another account." },
        { status: 400 }
      );
    }

    await confirmEmailChange({
      email: session.user.email,
      newEmail: email,
      identifier: session.user.id,
      hostName: APP_DOMAIN,
    });
  }

  const response = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name && { name }),
      ...(image && { image }),
    },
  });

  waitUntil(
    (async () => {
      if (
        image &&
        session.user.image &&
        session.user.image.startsWith(`${R2_URL}/avatars/${session.user.id}`)
      ) {
     
        await storage.delete({
          key: session.user.image.replace(`${R2_URL}/`, ""),
        });
      }
    })()
  );

  return NextResponse.json(response);
});

//  DELETE /api/user - Delete user account
export const DELETE = withSession(async ({ session }) => {
  const user = await prisma.user.delete({
    where: { id: session.user.id },
  });

  if (
    user.image &&
    user.image.startsWith(`${R2_URL}/avatars/${session.user.id}`)
  ) {
    await storage.delete({
      key: user.image.replace(`${R2_URL}/`, ""),
    });
  }

  return NextResponse.json(user);
});
