import { hashStringSHA256 } from "@repo/utils";
import { ipAddress } from "@vercel/functions";
import { userAgent } from "next/server";

/**
 * Combine IP + UA to create a unique identifier for the user (for deduplication)
 */
export async function getIdentityHash(req: Request) {
  const ip = ipAddress(req) || "127.0.0.1";
  const ua = userAgent(req);
  return await hashStringSHA256(`${ip}-${ua.ua}`);
}
