// // FILE: app/api/cron/social/reddit-mentions/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@repo/db";
// import { searchReddit, buildRedditQuery, type RedditPost } from "@/lib/social/reddit-api-client";
// import { tryConsumeQuota } from "@/lib/social/rate-limiter";

// function isAuthorized(req: NextRequest): boolean {
//   return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
// }

// const TERMS_PER_QUERY = 6;

// function chunk<T>(items: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
//   return out;
// }

// async function upsertRedditMention({
//   post,
//   workspaceId,
//   keywordIds,
// }: {
//   post: RedditPost;
//   workspaceId: string;
//   keywordIds: string[];
// }) {
//   const isBlocked = await prisma.accountBlocklist.findFirst({
//     where: { workspaceId, platform: "reddit", blockedAccountExternalId: post.author },
//   });
//   if (isBlocked) return;

//   const account = await prisma.socialAccount.upsert({
//     where: { platform_externalId: { platform: "reddit", externalId: post.author } },
//     update: { lastSeenAt: new Date() },
//     create: {
//       platform: "reddit",
//       externalId: post.author,
//       handle: post.author,
//       displayName: post.author,
//     },
//   });

//   const socialPost = await prisma.socialPost.upsert({
//     where: { platform_externalId: { platform: "reddit", externalId: post.id } },
//     update: {
//       likeCount: post.score,
//       replyCount: post.num_comments,
//       metricsUpdatedAt: new Date(),
//     },
//     create: {
//       platform: "reddit",
//       externalId: post.id,
//       socialAccountId: account.id,
//       content: `${post.title}\n\n${post.selftext ?? ""}`.trim(),
//       url: `https://reddit.com${post.permalink}`,
//       extractedUrls: [],
//       postedAt: new Date(post.created_utc * 1000),
//       likeCount: post.score,
//       replyCount: post.num_comments,
//       discoveredVia: "keyword_search",
//     },
//   });

//   await prisma.socialMention.upsert({
//     where: { workspaceId_socialPostId: { workspaceId, socialPostId: socialPost.id } },
//     update: { matchedKeywordIds: keywordIds },
//     create: {
//       workspaceId,
//       socialPostId: socialPost.id,
//       matchedKeywordIds: keywordIds,
//       firstMatchedAt: new Date(post.created_utc * 1000),
//     },
//   });
// }

// export async function POST(req: NextRequest) {
//   if (!isAuthorized(req)) {
//     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
//   }

//   // Per the product spec: keywords are shared between X and Reddit, and
//   // each workspace's own domain is auto-tracked on Reddit without needing
//   // a separate keyword entry.
//   const [keywords, domains] = await Promise.all([
//     prisma.socialKeyword.findMany({
//       where: { isActive: true, platforms: { has: "reddit" } },
//       select: { id: true, workspaceId: true, term: true },
//     }),
//     prisma.workspaceDomain.findMany({
//       where: { usedForSocialDiscovery: true },
//       select: { workspaceId: true, domain: true },
//     }),
//   ]);

//   const termsByWorkspace = new Map<string, { term: string; keywordId?: string }[]>();
//   for (const kw of keywords) {
//     const list = termsByWorkspace.get(kw.workspaceId) ?? [];
//     list.push({ term: kw.term, keywordId: kw.id });
//     termsByWorkspace.set(kw.workspaceId, list);
//   }
//   for (const d of domains) {
//     const list = termsByWorkspace.get(d.workspaceId) ?? [];
//     list.push({ term: d.domain });
//     termsByWorkspace.set(d.workspaceId, list);
//   }

//   let mentionsWritten = 0;
//   let rateLimited = false;

//   for (const [workspaceId, terms] of termsByWorkspace.entries()) {
//     for (const termChunk of chunk(terms, TERMS_PER_QUERY)) {
//       const allowed = await tryConsumeQuota({
//         key: "reddit-search",
//         limit: 55, // Reddit's OAuth app limit is ~60/min; leave headroom
//         windowSeconds: 60,
//       });
//       if (!allowed) {
//         rateLimited = true;
//         break;
//       }

//       try {
//         const posts = await searchReddit(buildRedditQuery(termChunk.map((t) => t.term)));
//         const keywordIds = termChunk.map((t) => t.keywordId).filter((id): id is string => Boolean(id));

//         for (const post of posts) {
//           await upsertRedditMention({ post, workspaceId, keywordIds });
//           mentionsWritten += 1;
//         }
//       } catch (error) {
//         console.error("[reddit-mentions] search failed", error);
//       }
//     }
//     if (rateLimited) break;
//   }

//   return NextResponse.json({ ok: true, mentionsWritten, rateLimited });
// }

// FILE: app/api/cron/social/reddit-mentions/route.ts

/**
 * CHANGES FROM PREVIOUS VERSION:
 *
 * 0. DOMAIN SOURCE CORRECTED — same issue as x-discovery.ts: was querying
 *    WorkspaceDomain.domain/usedForSocialDiscovery, which don't exist on
 *    your real WorkspaceDomain model. Now sources the auto-tracked domain
 *    from Workspace.domain directly. Same flagged assumption as
 *    x-discovery.ts applies — confirm or correct.
 *
 * 1. Eligibility filter (goals 1,2,3,4,6,9): keywords AND the auto-tracked
 *    domain are both gated through filterEligibleForPlatform(ids, "reddit")
 *    before any term reaches searchReddit(). A Growth workspace with no
 *    Reddit account connected contributes zero search terms.
 *
 * 2. Incremental sync (goals 5,7,8): 60-min per-workspace gate via
 *    lastRedditSyncAt. SAVINGS: if this worker's QStash schedule was
 *    previously 15 min, this is a 75% reduction in Reddit API calls per
 *    workspace (15 min -> 60 min cadence).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { searchReddit, buildRedditQuery, type RedditPost } from "@/lib/social/reddit-api-client";
import { tryConsumeQuota } from "@/lib/social/rate-limiter";
import { filterEligibleForPlatform } from "@/lib/billing/social-eligibility";
import { isDueForSync, markSyncedBatch } from "@/lib/social/sync-schedule";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

const TERMS_PER_QUERY = 6;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function upsertRedditMention({
  post,
  workspaceId,
  keywordIds,
}: {
  post: RedditPost;
  workspaceId: string;
  keywordIds: string[];
}) {
  const isBlocked = await prisma.accountBlocklist.findFirst({
    where: { workspaceId, platform: "reddit", blockedAccountExternalId: post.author },
  });
  if (isBlocked) return;

  const account = await prisma.socialAccount.upsert({
    where: { platform_externalId: { platform: "reddit", externalId: post.author } },
    update: { lastSeenAt: new Date() },
    create: {
      platform: "reddit",
      externalId: post.author,
      handle: post.author,
      displayName: post.author,
    },
  });

  const socialPost = await prisma.socialPost.upsert({
    where: { platform_externalId: { platform: "reddit", externalId: post.id } },
    update: {
      likeCount: post.score,
      replyCount: post.num_comments,
      metricsUpdatedAt: new Date(),
    },
    create: {
      platform: "reddit",
      externalId: post.id,
      socialAccountId: account.id,
      content: `${post.title}\n\n${post.selftext ?? ""}`.trim(),
      url: `https://reddit.com${post.permalink}`,
      extractedUrls: [],
      postedAt: new Date(post.created_utc * 1000),
      likeCount: post.score,
      replyCount: post.num_comments,
      discoveredVia: "keyword_search",
    },
  });

  await prisma.socialMention.upsert({
    where: { workspaceId_socialPostId: { workspaceId, socialPostId: socialPost.id } },
    update: { matchedKeywordIds: keywordIds },
    create: {
      workspaceId,
      socialPostId: socialPost.id,
      matchedKeywordIds: keywordIds,
      firstMatchedAt: new Date(post.created_utc * 1000),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [allKeywords, allWorkspacesWithDomain] = await Promise.all([
    prisma.socialKeyword.findMany({
      where: { isActive: true, platforms: { has: "reddit" } },
      select: { id: true, workspaceId: true, term: true },
    }),
    // FLAGGED ASSUMPTION — same as x-discovery.ts. Workspace.domain is
    // treated as "auto-tracked on Reddit without a separate keyword."
    prisma.workspace.findMany({
      where: { domain: { not: null } },
      select: { id: true, domain: true, lastRedditSyncAt: true },
    }),
  ]);

  const candidateIds = Array.from(
    new Set([
      ...allKeywords.map((k) => k.workspaceId),
      ...allWorkspacesWithDomain.map((w) => w.id),
    ])
  );

  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, searched: 0 });
  }

  // ── Step 1: Growth + connected-to-Reddit filter ────────────────────────
  const eligibleIds = await filterEligibleForPlatform(candidateIds, "reddit");

  // ── Step 2: due-for-sync filter (60 min), keyed off lastRedditSyncAt ───
  // Need lastRedditSyncAt for every eligible workspace, including ones
  // that only came from `allKeywords` (which didn't select that field).
  const eligibleWorkspaceSyncInfo = await prisma.workspace.findMany({
    where: { id: { in: Array.from(eligibleIds) } },
    select: { id: true, lastRedditSyncAt: true },
  });

  const dueWorkspaceIds = new Set(
    eligibleWorkspaceSyncInfo
      .filter((w) => isDueForSync(w.lastRedditSyncAt, "reddit"))
      .map((w) => w.id)
  );

  const termsByWorkspace = new Map<string, { term: string; keywordId?: string }[]>();
  for (const kw of allKeywords) {
    if (!dueWorkspaceIds.has(kw.workspaceId)) continue;
    const list = termsByWorkspace.get(kw.workspaceId) ?? [];
    list.push({ term: kw.term, keywordId: kw.id });
    termsByWorkspace.set(kw.workspaceId, list);
  }
  for (const w of allWorkspacesWithDomain) {
    if (!dueWorkspaceIds.has(w.id) || !w.domain) continue;
    const list = termsByWorkspace.get(w.id) ?? [];
    list.push({ term: w.domain });
    termsByWorkspace.set(w.id, list);
  }

  if (termsByWorkspace.size === 0) {
    return NextResponse.json({
      ok: true,
      searched: 0,
      skippedIneligible: candidateIds.length - eligibleIds.size,
      skippedNotDue: eligibleIds.size - dueWorkspaceIds.size,
    });
  }

  let mentionsWritten = 0;
  let rateLimited = false;
  const processedWorkspaceIds = new Set<string>();

  for (const [workspaceId, terms] of termsByWorkspace.entries()) {
    for (const termChunk of chunk(terms, TERMS_PER_QUERY)) {
      const allowed = await tryConsumeQuota({
        key: "reddit-search",
        limit: 55,
        windowSeconds: 60,
      });
      if (!allowed) {
        rateLimited = true;
        break;
      }

      try {
        const posts = await searchReddit(buildRedditQuery(termChunk.map((t) => t.term)));
        const keywordIds = termChunk.map((t) => t.keywordId).filter((id): id is string => Boolean(id));

        for (const post of posts) {
          await upsertRedditMention({ post, workspaceId, keywordIds });
          mentionsWritten += 1;
        }
        processedWorkspaceIds.add(workspaceId);
      } catch (error) {
        console.error("[reddit-mentions] search failed", error);
      }
    }
    if (rateLimited) break;
  }

  await markSyncedBatch(Array.from(processedWorkspaceIds), "reddit");

  return NextResponse.json({
    ok: true,
    mentionsWritten,
    rateLimited,
    skippedIneligible: candidateIds.length - eligibleIds.size,
    skippedNotDue: eligibleIds.size - dueWorkspaceIds.size,
  });
}