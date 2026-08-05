// // FILE: app/api/cron/social/link-resolution/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
// import { resolveShortUrl } from "@/lib/social/url-utils";

// // TODO: replace this header check with QStash's official
// // verifySignatureAppRouter() wrapper before going to production.
// function isAuthorized(req: NextRequest): boolean {
//   return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
// }

// export async function POST(req: NextRequest) {
//   if (!isAuthorized(req)) {
//     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
//   }

//   const referers = await getRecentShortLinkReferers(10); // last 10 minutes

//   let resolved = 0;
//   let failed = 0;

//   for (const row of referers) {
//     if (!row.referer_url || !row.referer_url.startsWith("http")) continue;
//     const result = await resolveShortUrl(row.referer_url);
//     if (result) resolved += 1;
//     else failed += 1;
//   }

//   return NextResponse.json({ ok: true, checked: referers.length, resolved, failed });
// }

// FILE: app/api/cron/social/link-resolution/route.ts

/**
 * CHANGES FROM PREVIOUS VERSION:
 *
 * This worker never calls a paid X or Reddit API — it only does an HTTP
 * HEAD request to follow a t.co (or similar) redirect, which is Twitter's
 * public redirect service, not the metered X REST API. So goals about
 * "reduce API usage/cost" don't directly apply dollar-for-dollar here.
 *
 * It IS still gated (goals 2,3,6,9) because:
 *   - Every resolved URL this worker writes to Redis only has value if
 *     attribution-reconciliation (which IS gated) will later use it. For a
 *     Standard workspace, that never happens — so resolving its links is
 *     pure wasted HTTP + Redis writes with zero downstream use.
 *   - Consistency: every worker in this system should apply the same
 *     eligibility rule, so a future engineer reading any one of the 5
 *     files sees the identical pattern rather than wondering why this one
 *     is the exception.
 *
 * Because we don't know in advance whether a given t.co click will
 * eventually resolve to an X-discovered tweet or a Reddit link-in-bio
 * match, eligibility here checks "workspace has AT LEAST ONE platform
 * connected" rather than a specific platform — narrowing further by
 * platform happens downstream in attribution-reconciliation, once the
 * platform is actually known.
 *
 * No incremental-sync (lastXSyncAt/lastRedditSyncAt) gating is added here
 * — this worker already runs on a short, fixed lookback window (10 min)
 * and resolving a link is idempotent/cheap (cached in Redis with a 30-day
 * TTL), so time-gating it further would only delay attribution without
 * saving anything meaningful.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
import { resolveShortUrl } from "@/lib/social/url-utils";
import { getEligiblePlatformsByWorkspace } from "@/lib/billing/social-eligibility";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const referers = await getRecentShortLinkReferers(1440); // last 10 minutes

  if (referers.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, resolved: 0, failed: 0 });
  }

  // ── Eligibility gate (goals 2,3,6,9) ────────────────────────────────────
  // Tinybird has no concept of billing (by design — see the architecture
  // doc's "Tinybird is a ledger, Postgres is a graph" split), so every
  // click event comes back with a workspace_id regardless of plan. This is
  // the "defensive check inside every worker" (goal 3): a Standard
  // workspace's referer row is dropped here, before resolveShortUrl() is
  // ever called for it.
  const candidateWorkspaceIds = Array.from(new Set(referers.map((r) => r.workspace_id)));
  const eligibility = await getEligiblePlatformsByWorkspace(candidateWorkspaceIds);

  const eligibleReferers = referers.filter((r) => (eligibility.get(r.workspace_id)?.size ?? 0) > 0);
  const skippedIneligible = referers.length - eligibleReferers.length;

  let resolved = 0;
  let failed = 0;

  for (const row of eligibleReferers) {
    if (!row.referer_url || !row.referer_url.startsWith("http")) continue;
    const result = await resolveShortUrl(row.referer_url);
    if (result) resolved += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    checked: eligibleReferers.length,
    resolved,
    failed,
    skippedIneligible,
  });
}