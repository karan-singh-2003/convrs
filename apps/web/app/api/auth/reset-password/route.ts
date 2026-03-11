import { hashPassword, validatePassword } from "@/lib/auth/password";
import { resetPasswordSchema } from "@/lib/zod/schemas/auth";
import { sendEmail } from "@repo/email";
import PasswordUpdated from "@repo/email/templates/password-updated";
import { prisma } from "@repo/db";
import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";

// POST /api/auth/reset-password - reset password using the reset token
export async function POST(req: NextRequest) {
  try {
    const { token, password } = resetPasswordSchema.parse(await req.json());

    // Find the token
    const tokenFound = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expires: {
          gte: new Date(),
        },
      },
      select: {
        identifier: true,
      },
    });

    if (!tokenFound) {
      throw new Error("Invalid or expired password reset token.");
    }

    const { identifier } = tokenFound;

    const user = await prisma.user.findUnique({
      where: {
        id: identifier,
      },
      select: {
        emailVerified: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new Error("No account found for this reset link.");
    }

    // Check if the new password is the same as the current password
    if (user.passwordHash) {
      const isSamePassword = await validatePassword(
        password,
        user.passwordHash
      );

      if (isSamePassword) {
        throw new Error(
          "Your new password cannot be the same as your current password."
        );
      }
    }

    await prisma.$transaction([
      // Delete the token
      prisma.passwordResetToken.deleteMany({
        where: {
          token,
        },
      }),

      // Update the user's password
      prisma.user.update({
        where: {
          id: identifier,
        },
        data: {
          passwordHash: await hashPassword(password),
          ...(!user.emailVerified && { emailVerified: new Date() }), // Mark the email as verified
        },
      }),
    ]);

    // Send the email to inform the user that their password has been reset
    waitUntil(
      sendEmail({
        subject: "Your Boilercode account password has been reset",
        to: identifier,
        react: PasswordUpdated({
          email: identifier,
          verb: "reset",
        }),
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
