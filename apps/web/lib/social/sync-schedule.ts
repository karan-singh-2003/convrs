// FILE: lib/social/sync-schedule.ts

/**
 * Single source of truth for "how often should each platform actually be
 * synced," decoupled from whatever cadence QStash is configured to invoke
 * the worker at. This matters because:
 *
 *   - QStash's own schedule interval lives in QStash's config (outside your
 *     codebase) — changing it requires a QStash API call/dashboard edit,
 *     not a code deploy.
 *   - This file's SYNC_INTERVAL_MINUTES is a code-level, version-controlled,
 *     instantly-deployable ceiling on a per-WORKSPACE basis. Even if QStash
 *     is (mis)configured to fire every 5 minutes, no single workspace gets
 *     synced more often than what's defined here — the worker itself
 *     enforces the interval per workspace via lastXSyncAt/lastRedditSyncAt.
 *
 * INFRA/COST SAVINGS: this is what actually implements goal 5's "X every
 * 30 min, Reddit every 60 min" — moving x-mentions from its previous 10-min
 * QStash interval to being gated at 30 min per workspace cuts X API calls
 * for that worker by ~66% (3x fewer searches per workspace per day), and
 * reddit-mentions moving from 15 min to 60 min cuts Reddit calls by 75%.
 * These are the single largest cost reductions in this whole change set.
 */

import { prisma } from "@repo/db";

export const SYNC_INTERVAL_MINUTES = {
  x: 30,
  reddit: 60,
} as const;

type SyncPlatform = keyof typeof SYNC_INTERVAL_MINUTES;

export function isDueForSync(
  lastSyncAt: Date | null,
  platform: SyncPlatform
): boolean {
  if (!lastSyncAt) return true;
  const dueAt = lastSyncAt.getTime() + SYNC_INTERVAL_MINUTES[platform] * 60_000;
  return Date.now() >= dueAt;
}

/** Call once per workspace actually processed in a run — including runs
 * that found zero new mentions/tweets, so a quiet workspace doesn't get
 * re-searched again before its interval is up. */
export async function markSynced(
  workspaceId: string,
  platform: SyncPlatform
): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data:
      platform === "x"
        ? { lastXSyncAt: new Date() }
        : { lastRedditSyncAt: new Date() },
  });
}

/** Batched version — call once per worker run instead of once per
 * workspace, since Prisma has no bulk "different value per row" update in
 * a single statement; this at least avoids N sequential round-trips by
 * running them concurrently. */
export async function markSyncedBatch(
  workspaceIds: string[],
  platform: SyncPlatform
): Promise<void> {
  if (workspaceIds.length === 0) return;
  const field = platform === "x" ? "lastXSyncAt" : "lastRedditSyncAt";
  await prisma.workspace.updateMany({
    where: { id: { in: workspaceIds } },
    data: { [field]: new Date() },
  });
}