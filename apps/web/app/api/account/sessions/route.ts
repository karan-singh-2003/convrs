import { withSession } from "@/lib/auth";
import {
  REVOKED_SESSION_KEY_PREFIX,
  REVOKED_SESSION_TTL_SECONDS,
} from "@/lib/auth/session-tracking";
import { redis } from "@/lib/upstash";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

// GET /api/account/sessions – List all sessions for the current user
export const GET = withSession(async ({ req, session, searchParams }) => {
  const page = parseInt(searchParams.page || "1", 10);
  const limit = parseInt(searchParams.limit || "5", 10);
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: { userId: session.user.id },
      orderBy: { lastActive: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        browser: true,
        os: true,
        ipAddress: true,
        location: true,
        lastActive: true,
        createdAt: true,
        sessionToken: true,
      },
    }),
    prisma.session.count({
      where: { userId: session.user.id },
    }),
  ]);

  // Identify the current session using the tracked session token stored in the JWT,
  // which is forwarded through the NextAuth session callback.
  const currentSessionToken = (session as any).sessionToken ?? null;

  const sessionsWithCurrent = sessions.map((s) => ({
    ...s,
    sessionToken: undefined, // Don't expose the token
    isCurrent: !!currentSessionToken && s.sessionToken === currentSessionToken,
  }));

  return NextResponse.json({
    sessions: sessionsWithCurrent,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// DELETE /api/account/sessions – Revoke a specific session
export const DELETE = withSession(async ({ req, session }) => {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Only allow deleting own sessions
    const targetSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Add to Redis blocklist BEFORE deleting so the JWT is immediately invalid
    // even though it remains in the user's browser cookie.
    await redis.set(
      `${REVOKED_SESSION_KEY_PREFIX}${targetSession.sessionToken}`,
      "1",
      { ex: REVOKED_SESSION_TTL_SECONDS }
    );

    await prisma.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ message: "Session revoked successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
});
