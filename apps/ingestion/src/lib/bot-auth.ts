import { createHash } from "node:crypto";

/**
 * Bot-traffic ingestion auth. Accepts the website's dedicated bot-traffic
 * token (`cvbot_`, Settings → Script → Bot traffic; not usable on the public
 * API) and, for existing installs, the workspace's API tokens (`cvrs_`, and
 * the legacy `bc_`). All live in RestrictedToken, hashed with SHA-256 over
 * the raw token exactly like hashToken() in apps/web. Parsing matches
 * apps/web's extractBearerToken(): case-insensitive "Bearer", trimmed token.
 */
export const VALID_BOT_TOKEN_PREFIXES = ["cvbot_", "cvrs_", "bc_"];

// Short, so a rotated or deleted token stops working within seconds while
// a crawler burst still costs one DB lookup per token per instance.
const CACHE_TTL_MS = 10_000;
const CACHE_MAX = 5_000;
const verdicts = new Map<string, { expires: number; valid: boolean }>();

export function extractBearerToken(authorization: string | string[] | undefined): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value) return null;
  const match = /^\s*bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1]! : null;
}

export function hashBotToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type TokenLookup = (hashedKey: string, workspaceId: string) => Promise<{ expires: Date | null } | null>;

const lookupToken: TokenLookup = async (hashedKey, workspaceId) => {
  const { prisma } = await import("@repo/db");
  return prisma.restrictedToken.findFirst({
    where: { hashedKey, workspaceId },
    select: { expires: true },
  });
};

export async function isValidBotToken(
  token: string | null,
  workspaceId: string,
  lookup: TokenLookup = lookupToken,
  now: () => number = Date.now
): Promise<boolean> {
  if (!token || !VALID_BOT_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) {
    return false;
  }

  const hashedKey = hashBotToken(token);
  const cacheKey = `${workspaceId}:${hashedKey}`;
  const cached = verdicts.get(cacheKey);
  if (cached && cached.expires > now()) return cached.valid;

  const row = await lookup(hashedKey, workspaceId);
  const valid = !!row && (!row.expires || row.expires.getTime() > now());

  if (verdicts.size >= CACHE_MAX) {
    const oldest = verdicts.keys().next().value;
    if (oldest !== undefined) verdicts.delete(oldest);
  }
  verdicts.set(cacheKey, { expires: now() + CACHE_TTL_MS, valid });
  return valid;
}

export function clearBotTokenCache() {
  verdicts.clear();
}
