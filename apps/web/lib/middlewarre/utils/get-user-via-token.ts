import { REVOKED_SESSION_KEY_PREFIX } from "@/lib/auth/session-tracking";
import { UserProps } from "@/lib/types";
import { redisWithTimeout } from "@/lib/upstash";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { sql } from "@repo/db/edge";

export async function getUserViaToken(req: NextRequest) {
  const session = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as {
    email?: string;
    user?: UserProps;
    sessionToken?: string;
  };

  if (!session?.user) return undefined;

  // Check if session was revoked
  if (session.sessionToken) {
    try {
      const revoked = await redisWithTimeout.get(
        `${REVOKED_SESSION_KEY_PREFIX}${session.sessionToken}`
      );
      if (revoked) return undefined;
    } catch {
      // fail open
    }
  }

  const rows = await sql`
    SELECT id
    FROM "User"
    WHERE id = ${session.user.id}
    LIMIT 1
  `;

  if (!rows?.length) {
    return undefined;
  }

  return session.user;
}