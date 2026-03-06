import { withSession } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  source: z.string().min(1).max(50),
});

// PATCH /api/account/source – Save how the user discovered the product
export const PATCH = withSession(async ({ req, session }) => {
  try {
    const body = await req.json();
    const { source } = schema.parse(body);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { source },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to save source" },
      { status: 500 }
    );
  }
});
