import { hashStringSHA256 } from "@repo/utils";
import { parseUserAgent } from "./parse-user-agent";
import { getIpAddress } from "./get-ip-address";

/**
 * Combine IP + UA to create a unique identifier for the user (for deduplication)
 */
export async function getIdentityHash(req: Request) {
  const ip = getIpAddress(req) || "127.0.0.1";
  const uaString = req.headers.get("user-agent") || "";
  const ua = parseUserAgent(uaString);
  return await hashStringSHA256(`${ip}-${ua.ua}`);
}
