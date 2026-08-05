// FILE: lib/billing/social-eligibility.ts

/**
 * Supersedes lib/billing/growth-workspace-filter.ts from the previous
 * refactor — delete that file, this replaces it.
 *
 * Why: the old filterToGrowthWorkspaceIds() only checked pricing family.
 * Every worker then had to ALSO separately check "is X/Reddit connected"
 * (goal 4), which meant either a second DB round-trip per worker or
 * duplicated inline logic (goal 9 explicitly asks to avoid this). This
 * single function does both checks in ONE query and returns a structure
 * every worker can use identically regardless of which platform(s) it cares
 * about.
 *
 * INFRA SAVINGS: collapses what would otherwise be 2 queries per worker
 * run (1 for plan family, 1 for integration status) x 5 workers into 1
 * query per worker run — a straight 50% reduction in eligibility-check
 * DB round-trips, on top of being the single place this logic lives at all.
 *
 * Downgrade handling (goal 6): there is no persistent "scheduled job" per
 * workspace to cancel — every worker recomputes eligibility from scratch
 * on every run by calling this function. A workspace that downgrades from
 * Growth to Standard simply stops appearing in this function's result on
 * the VERY NEXT worker invocation. No separate cancellation code path is
 * needed, and none should be added — a second mechanism here would be
 * duplicated state that can drift out of sync with the real plan.
 */

import { prisma } from "@repo/db";

export type SocialWorkerPlatform = "x" | "reddit";

/**
 * Returns a Map<workspaceId, Set<connected platform>> restricted to:
 *   - workspaces in `workspaceIds`
 *   - on the Growth pricing family
 *   - with at least one ACTIVE SocialIntegration (platform-specific — a
 *     workspace with only X connected will not appear under "reddit")
 *
 * A workspaceId absent from the returned map, or present with an empty
 * Set, means "do not call ANY API for this workspace" — every worker
 * must treat both cases identically.
 */
export async function getEligiblePlatformsByWorkspace(
  workspaceIds: string[]
): Promise<Map<string, Set<SocialWorkerPlatform>>> {
  if (workspaceIds.length === 0) return new Map();

  const rows = await prisma.workspace.findMany({
    where: {
      id: { in: Array.from(new Set(workspaceIds)) },
      planFamily: "growth",
    },
    select: {
      id: true,
      socialIntegrations: {
        where: { status: "active" },
        select: { platform: true },
      },
    },
  });

  const map = new Map<string, Set<SocialWorkerPlatform>>();
  for (const row of rows) {
    const platforms = new Set(
      row.socialIntegrations.map((si) => si.platform as SocialWorkerPlatform)
    );
    if (platforms.size > 0) map.set(row.id, platforms);
  }
  return map;
}

/** Convenience wrapper for the common case: a worker only cares about one
 * specific platform (x-discovery only ever needs "x", reddit-mentions only
 * ever needs "reddit"). */
export async function filterEligibleForPlatform(
  workspaceIds: string[],
  platform: SocialWorkerPlatform
): Promise<Set<string>> {
  const eligibility = await getEligiblePlatformsByWorkspace(workspaceIds);
  const result = new Set<string>();
  for (const [workspaceId, platforms] of eligibility) {
    if (platforms.has(platform)) result.add(workspaceId);
  }
  return result;
}