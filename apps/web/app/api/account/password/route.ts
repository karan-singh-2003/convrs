import { withSession } from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

// POST /api/account/password – Create password (for OAuth users)
export const POST = withSession(async ({ req, session }) => {
  try {
    const body = await req.json();
    const { newPassword } = createPasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { error: "Password already set. Use PUT to update." },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: hashedPassword },
    });

    return NextResponse.json({ message: "Password created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create password" },
      { status: 500 }
    );
  }
});

// PUT /api/account/password – Update existing password
export const PUT = withSession(async ({ req, session }) => {
  try {
    const body = await req.json();
    const { currentPassword, newPassword } = updatePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "No password set. Use POST to create one." },
        { status: 400 }
      );
    }

    const isValid = await validatePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: hashedPassword },
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
});
