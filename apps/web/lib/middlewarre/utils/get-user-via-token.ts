import { REVOKED_SESSION_KEY_PREFIX } from "@/lib/auth/session-tracking";
import { UserProps } from "@/lib/types";
import { redisWithTimeout } from "@/lib/upstash";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

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

  // If the session was revoked, treat the request as unauthenticated.
  if (session.sessionToken) {
    try {
      const revoked = await redisWithTimeout.get(
        `${REVOKED_SESSION_KEY_PREFIX}${session.sessionToken}`
      );
      if (revoked) return undefined;
    } catch {
      // Redis timeout — fail open to avoid blocking all traffic
    }
  }

  return session.user;
}
