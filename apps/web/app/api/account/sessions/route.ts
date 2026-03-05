import { withSession } from "@/lib/auth";
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

  // Determine which session is the current one by matching the session token
  // from the cookie
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionTokenMatch = cookieHeader.match(
    /(?:__Secure-)?next-auth\.session-token=([^;]+)/
  );
  const currentSessionToken = sessionTokenMatch
    ? decodeURIComponent(sessionTokenMatch[1])
    : null;

  const sessionsWithCurrent = sessions.map((s) => ({
    ...s,
    sessionToken: undefined, // Don't expose the token
    isCurrent: s.sessionToken === currentSessionToken,
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
