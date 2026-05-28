/**
 * live-presence.ts
 *
 * Manages live visitor tracking in Redis using a sorted set per workspace.
 * Score = last seen timestamp (ms). Stale entries (>30s) are pruned on read.
 *
 * Redis key structure:
 *   live:{workspaceId}          → ZSet  { member: "visitorId|page", score: timestamp }
 *   live:{workspaceId}:pages    → ZSet  { member: "/pricing",       score: count }
 */

import { Redis } from "@upstash/redis"; // or "ioredis" — swap client as needed
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

// ─── Client ──────────────────────────────────────────────────────────────────
// Upstash (serverless):
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// If using ioredis instead, replace with:
// export const redis = new IORedis(process.env.REDIS_URL!);

// ─── Constants ────────────────────────────────────────────────────────────────
const VISITOR_TTL_MS = 30_000; // visitor considered offline after 30s of no heartbeat
const KEY_EXPIRY_SEC = 300; // expire the whole key after 5 min of no activity

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HeartbeatPayload {
  workspaceId: string;
  visitorId: string;
  sessionId: string;
  page: string;
  url: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  referrer?: string;
}

export interface LiveStats {
  count: number; // total active visitors right now
  pages: PageStat[]; // breakdown by page
  points: LivePoint[]; // live geo points for realtime globe
  referrers: ReferrerStat[]; // breakdown by referrer
  countries: CountryStat[]; // breakdown by country
}

export interface PageStat {
  page: string;
  count: number;
}

export interface LivePoint {
  id: string;
  latitude: number;
  longitude: number;
  value: number;
}

export interface ReferrerStat {
  source: string;
  count: number;
}

export interface CountryStat {
  country: string;
  code: string;
  count: number;
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Record a heartbeat for a visitor.
 * Updates their score (last seen) in the sorted set and prunes stale visitors.
 */
export async function recordHeartbeat(
  payload: HeartbeatPayload
): Promise<LiveStats> {
  const {
    workspaceId,
    visitorId,
    page,
    latitude,
    longitude,
    country,
    referrer,
  } = payload;
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);

  const key = `live:${normalizedWorkspaceId}`;
  // Member format: visitorId|page|latitude|longitude|country|referrer
  const member = [
    visitorId,
    page,
    latitude ?? "",
    longitude ?? "",
    encodeURIComponent(country ?? ""),
    encodeURIComponent(referrer ?? ""),
  ].join("|");
  const now = Date.now();
  const cutoff = now - VISITOR_TTL_MS;

  // Pipeline: update score + prune stale + set expiry — all in one round trip
  const pipeline = redis.pipeline();

  // 1. Upsert visitor with current timestamp as score
  pipeline.zadd(key, { score: now, member });

  // 2. Remove visitors not seen in last 30s
  pipeline.zremrangebyscore(key, 0, cutoff);

  // 3. Keep key alive — reset expiry on every heartbeat
  pipeline.expire(key, KEY_EXPIRY_SEC);

  await pipeline.exec();

  // 4. Read current live stats
  return getLiveStats(normalizedWorkspaceId);
}

/**
 * Get current live visitor count and page breakdown for a workspace.
 */
export async function getLiveStats(projectToken: string): Promise<LiveStats> {
  const normalizedWorkspaceId = normalizeWorkspaceId(projectToken);
  const key = `live:${normalizedWorkspaceId}`;
  const cutoff = Date.now() - VISITOR_TTL_MS;

  // Get all active members (score > cutoff).
  const members = await redis.zrange<string[]>(key, cutoff, Date.now(), {
    byScore: true,
  });

  if (!members || members.length === 0) {
    return { count: 0, pages: [], points: [], referrers: [], countries: [] };
  }

  // Group by page and coordinates.
  const pageCounts = new Map<string, number>();
  const pointCounts = new Map<string, LivePoint>();
  const referrerCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  for (const member of members) {
    const [
      visitorId = "",
      page = "/",
      latRaw = "",
      lonRaw = "",
      countryRaw = "",
      referrerRaw = "",
    ] = member.split("|");

    pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1);

    const decodedCountry = decodeURIComponent(countryRaw || "").trim();
    if (decodedCountry) {
      countryCounts.set(
        decodedCountry,
        (countryCounts.get(decodedCountry) ?? 0) + 1
      );
    }

    const decodedReferrer = decodeURIComponent(referrerRaw || "").trim();
    if (decodedReferrer) {
      referrerCounts.set(
        decodedReferrer,
        (referrerCounts.get(decodedReferrer) ?? 0) + 1
      );
    }

    const latitude = Number(latRaw);
    const longitude = Number(lonRaw);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const pointKey = `${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
      const existing = pointCounts.get(pointKey);
      if (existing) {
        existing.value += 1;
      } else {
        pointCounts.set(pointKey, {
          id: `${visitorId || "live"}-${pointKey}`,
          latitude,
          longitude,
          value: 1,
        });
      }
    }
  }

  const pages: PageStat[] = Array.from(pageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  const countries: CountryStat[] = Array.from(countryCounts.entries())
    .map(([country, count]) => ({
      country,
      code: country.toUpperCase(),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const referrers: ReferrerStat[] = Array.from(referrerCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    count: members.length,
    pages,
    points: Array.from(pointCounts.values()).sort((a, b) => b.value - a.value),
    referrers,
    countries,
  };
}

/**
 * Remove a visitor immediately (e.g. on explicit logout).
 */
export async function removeVisitor(
  workspaceId: string,
  visitorId: string
): Promise<void> {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const key = `live:${normalizedWorkspaceId}`;

  // Remove all members that start with this visitorId.
  const members = await redis.zrange<string[]>(key, 0, -1);
  const toRemove = members.filter((m) => m.startsWith(`${visitorId}|`));

  if (toRemove.length > 0) {
    await redis.zrem(key, ...toRemove);
  }
}
