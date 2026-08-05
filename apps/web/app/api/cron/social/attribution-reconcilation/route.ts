// // FILE: app/api/cron/social/attribution-reconciliation/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@repo/db";
// import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
// import { normalizeUrl, resolveShortUrl, parseProfileReferer } from "@/lib/social/url-utils";

// function isAuthorized(req: NextRequest): boolean {
//   return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
// }

// export async function POST(req: NextRequest) {
//   if (!isAuthorized(req)) {
//     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
//   }

//   // Wider window than the Link Resolution Worker's — this catches
//   // attribution for tweets that were only discovered *after* the
//   // original clicks came in (the whole point of reconciliation).
//   const referers = await getRecentShortLinkReferers(60 * 48);

//   let matched = 0;
//   let skipped = 0;

//   for (const row of referers) {
//     const alreadyAttributed = await prisma.linkAttribution.findUnique({
//       where: { eventId: row.event_id },
//       select: { id: true },
//     });
//     if (alreadyAttributed) {
//       skipped += 1;
//       continue;
//     }

//     // ── Case 1: link-in-bio (referer is a bare profile URL) ──────────
//     const profileRef = parseProfileReferer(row.referer_url);
//     if (profileRef) {
//       const allowedHandle = await prisma.socialAttributionHandle.findFirst({
//         where: {
//           workspaceId: row.workspace_id,
//           platform: profileRef.platform,
//           handle: { equals: profileRef.handle, mode: "insensitive" },
//         },
//       });

//       if (allowedHandle) {
//         const account = await prisma.socialAccount.upsert({
//           where: {
//             platform_externalId: {
//               platform: profileRef.platform,
//               // We don't have the platform's numeric ID from a bare
//               // referer URL — key on handle instead for this path.
//               externalId: `handle:${profileRef.handle.toLowerCase()}`,
//             },
//           },
//           update: { lastSeenAt: new Date() },
//           create: {
//             platform: profileRef.platform,
//             externalId: `handle:${profileRef.handle.toLowerCase()}`,
//             handle: profileRef.handle,
//           },
//         });

//         await prisma.linkAttribution.create({
//           data: {
//             workspaceId: row.workspace_id,
//             eventId: row.event_id,
//             visitorId: row.visitor_id,
//             socialAccountId: account.id,
//             socialPostId: null,
//             confidence: "medium",
//             confidenceScore: 0.6,
//             matchMethod: "link_in_bio",
//             matchedAt: new Date(row.timestamp),
//           },
//         });
//         matched += 1;
//         continue;
//       }
//     }

//     // ── Case 2: exact-URL match against a discovered tweet ───────────
//     const resolvedUrl = await resolveShortUrl(row.referer_url);
//     if (!resolvedUrl) {
//       skipped += 1;
//       continue;
//     }

//     const normalized = normalizeUrl(resolvedUrl);
//     if (!normalized) {
//       skipped += 1;
//       continue;
//     }

//     const candidates = await prisma.socialPost.findMany({
//       where: { extractedUrls: { has: normalized }, status: "active" },
//       include: { socialAccount: true },
//     });

//     if (candidates.length === 0) {
//       skipped += 1;
//       continue;
//     }

//     const clickTime = new Date(row.timestamp).getTime();
//     const best = candidates.reduce((closest, candidate) => {
//       const diff = Math.abs(candidate.postedAt.getTime() - clickTime);
//       const closestDiff = Math.abs(closest.postedAt.getTime() - clickTime);
//       return diff < closestDiff ? candidate : closest;
//     }, candidates[0]);

//     await prisma.linkAttribution.create({
//       data: {
//         workspaceId: row.workspace_id,
//         eventId: row.event_id,
//         visitorId: row.visitor_id,
//         socialAccountId: best.socialAccountId,
//         socialPostId: best.id,
//         confidence: candidates.length === 1 ? "high" : "medium",
//         confidenceScore: candidates.length === 1 ? 0.95 : 0.6,
//         matchMethod: "exact_url",
//         matchedAt: new Date(row.timestamp),
//       },
//     });
//     matched += 1;
//   }

//   return NextResponse.json({ ok: true, checked: referers.length, matched, skipped });
// }

// FILE: app/api/cron/social/attribution-reconciliation/route.ts

/**
 * CHANGES FROM PREVIOUS VERSION:
 *
 * Like link-resolution.ts, this worker never calls a paid X/Reddit API —
 * it only does Postgres lookups (matching a resolved URL against
 * SocialPost.extractedUrls, or checking SocialAttributionHandle). So this
 * change eliminates wasted DB writes/queries for ineligible workspaces,
 * not API spend.
 *
 * Two-level gating, because this worker handles BOTH attribution paths
 * and each has a different natural point where "platform" becomes known:
 *
 *   1. Coarse gate (any platform connected) applied to the whole referer
 *      list up front — identical pattern to link-resolution.ts, and for
 *      the same reason (goal 3's "defensive check ... before calling any
 *      external API" — even though this worker calls none, the same
 *      early-exit shape is kept for consistency, goal 9).
 *
 *   2. Platform-specific gate applied at the two points where platform
 *      actually becomes known:
 *        - link-in-bio branch: platform is known immediately from
 *          parseProfileReferer() (x.com vs reddit.com URL shape) — checked
 *          before creating/upserting a SocialAccount for that platform.
 *        - exact-URL branch: platform is only known once a candidate
 *          SocialPost is found (it could theoretically be an X or Reddit
 *          post) — checked right before writing the LinkAttribution row.
 *
 * This matters for the downgrade scenario (goal 6): if a workspace has X
 * connected but not Reddit, and a resolved URL happens to match a
 * Reddit-discovered post (e.g. from before they disconnected Reddit), we
 * still shouldn't create new attribution data referencing a disconnected
 * platform going forward.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
import { normalizeUrl, resolveShortUrl, parseProfileReferer } from "@/lib/social/url-utils";
import { getEligiblePlatformsByWorkspace } from "@/lib/billing/social-eligibility";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const referers = await getRecentShortLinkReferers(60 * 48);

  if (referers.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, matched: 0, skipped: 0 });
  }

  // ── Coarse eligibility gate (any platform connected) ───────────────────
  const candidateWorkspaceIds = Array.from(new Set(referers.map((r) => r.workspace_id)));
  const eligibility = await getEligiblePlatformsByWorkspace(candidateWorkspaceIds);

  const eligibleReferers = referers.filter(
    (r) => (eligibility.get(r.workspace_id)?.size ?? 0) > 0
  );
  const skippedIneligible = referers.length - eligibleReferers.length;

  let matched = 0;
  let skipped = 0;

  for (const row of eligibleReferers) {
    const workspacePlatforms = eligibility.get(row.workspace_id) ?? new Set();

    const alreadyAttributed = await prisma.linkAttribution.findUnique({
      where: { eventId: row.event_id },
      select: { id: true },
    });

    // console.log("already attributed", alreadyAttributed)
    if (alreadyAttributed) {
      skipped += 1;
      continue;
    }

    // ── Case 1: link-in-bio ────────────────────────────────────────────
    const profileRef = parseProfileReferer(row.referer_url);
    if (profileRef) {
      // Platform-specific gate — see file header. A resolved x.com/handle
      // referer for a workspace that only has Reddit connected is skipped
      // here, before any SocialAccount write.
      if (!workspacePlatforms.has(profileRef.platform)) {
        skipped += 1;
        continue;
      }

      const allowedHandle = await prisma.socialAttributionHandle.findFirst({
        where: {
          workspaceId: row.workspace_id,
          platform: profileRef.platform,
          handle: { equals: profileRef.handle, mode: "insensitive" },
        },
      });

      if (allowedHandle) {
        const account = await prisma.socialAccount.upsert({
          where: {
            platform_externalId: {
              platform: profileRef.platform,
              externalId: `handle:${profileRef.handle.toLowerCase()}`,
            },
          },
          update: { lastSeenAt: new Date() },
          create: {
            platform: profileRef.platform,
            externalId: `handle:${profileRef.handle.toLowerCase()}`,
            handle: profileRef.handle,
          },
        });

        await prisma.linkAttribution.create({
          data: {
            workspaceId: row.workspace_id,
            eventId: row.event_id,
            visitorId: row.visitor_id,
            socialAccountId: account.id,
            socialPostId: null,
            refererUrl: row.referer_url,
            confidence: "medium",
            confidenceScore: 0.6,
            matchMethod: "link_in_bio",
            matchedAt: new Date(row.timestamp),
          },
        });
        matched += 1;
        continue;
      }
    }

    // ── Case 2: exact-URL match against a discovered post ───────────────
    // console.log("referer_url", row.referer_url);
    const resolvedUrl = await resolveShortUrl(row.referer_url);
    // console.log("resolvedUrl", resolvedUrl);

    if (!resolvedUrl) {
      skipped += 1;
      continue;
    }

    const normalized = normalizeUrl(resolvedUrl);
    // console.log("normalized", normalized);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    const allPosts = await prisma.socialPost.findMany({
      select: {
        id: true,
        extractedUrls: true,
        status: true,
        platform: true,
      },
    });

    // console.log("normalized =", normalized);
    // console.log("all social posts =", JSON.stringify(allPosts, null, 2));

    const candidates = await prisma.socialPost.findMany({
      where: {
        extractedUrls: {
          has: normalized,
        },
        status: "active",
      },
      include: {
        socialAccount: true,
      },
    });

    // console.log("candidates =", JSON.stringify(candidates, null, 2));

    // Platform-specific gate — only keep candidates on a platform this
    // workspace actually has connected. A workspace with X connected but
    // not Reddit should not get a new attribution row pointing at a
    // Reddit post, even if the URL happens to match.
    const eligibleCandidates = candidates.filter((c) => workspacePlatforms.has(c.platform));

    if (eligibleCandidates.length === 0) {
      skipped += 1;
      continue;
    }

    const clickTime = new Date(row.timestamp).getTime();
    const best = eligibleCandidates.reduce((closest, candidate) => {
      const diff = Math.abs(candidate.postedAt.getTime() - clickTime);
      const closestDiff = Math.abs(closest.postedAt.getTime() - clickTime);
      return diff < closestDiff ? candidate : closest;
    }, eligibleCandidates[0]);

    await prisma.linkAttribution.create({
      data: {
        workspaceId: row.workspace_id,
        eventId: row.event_id,
        visitorId: row.visitor_id,
        socialAccountId: best.socialAccountId,
        socialPostId: best.id,
        refererUrl: row.referer_url,
        confidence: eligibleCandidates.length === 1 ? "high" : "medium",
        confidenceScore: eligibleCandidates.length === 1 ? 0.95 : 0.6,
        matchMethod: "exact_url",
        matchedAt: new Date(row.timestamp),
      },
    });
    matched += 1;
  }

  return NextResponse.json({
    ok: true,
    checked: eligibleReferers.length,
    matched,
    skipped,
    skippedIneligible,
  });
}