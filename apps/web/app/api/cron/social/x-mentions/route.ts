// // FILE: app/api/cron/social/x-mentions/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@repo/db";
// import {
//   searchRecentTweets,
//   buildKeywordSearchQuery,
//   XRateLimitError,
//   type XTweet,
//   type XUser,
// } from "@/lib/social/x-api-client";
// import { extractUrlsFromText } from "@/lib/social/url-utils";
// import { tryConsumeQuota, trackMonthlyUsage } from "@/lib/social/rate-limiter";

// function isAuthorized(req: NextRequest): boolean {
//   return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
// }

// const KEYWORDS_PER_QUERY = 8;

// function chunk<T>(items: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
//   return out;
// }

// async function isSpammy(authorId: string): Promise<boolean> {
//   // Placeholder spam heuristic — extend with account-age / duplicate-content
//   // checks per the architecture doc's spam-filtering section. Kept minimal
//   // here so the worker is functional end-to-end.
//   return false;
// }

// export async function POST(req: NextRequest) {
//   if (!isAuthorized(req)) {
//     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
//   }

//   const { withinCap } = await trackMonthlyUsage({
//     key: "x-api-reads",
//     cap: Number(process.env.X_API_MONTHLY_READ_CAP ?? 10000),
//   });
//   if (!withinCap) {
//     return NextResponse.json({ ok: false, reason: "monthly_cap_reached" });
//   }

//   const keywords = await prisma.socialKeyword.findMany({
//     where: { isActive: true, platforms: { has: "x" } },
//     select: { id: true, workspaceId: true, term: true },
//   });

//   if (keywords.length === 0) {
//     return NextResponse.json({ ok: true, searched: 0 });
//   }

//   // Batch by distinct term (multiple workspaces tracking the same term
//   // ride in one API call), then fan the results back out to every
//   // workspace/keyword that term belongs to.
//   const keywordsByTerm = new Map<string, { workspaceId: string; keywordId: string }[]>();
//   for (const kw of keywords) {
//     const list = keywordsByTerm.get(kw.term) ?? [];
//     list.push({ workspaceId: kw.workspaceId, keywordId: kw.id });
//     keywordsByTerm.set(kw.term, list);
//   }

//   const distinctTerms = Array.from(keywordsByTerm.keys());
//   const termChunks = chunk(distinctTerms, KEYWORDS_PER_QUERY);

//   let mentionsWritten = 0;
//   let rateLimited = false;

//   for (const termChunk of termChunks) {
//     const allowed = await tryConsumeQuota({
//       key: "x-search-recent",
//       limit: 60,
//       windowSeconds: 900,
//     });
//     if (!allowed) {
//       rateLimited = true;
//       break;
//     }

//     let tweets: XTweet[] = [];
//     let users: XUser[] = [];

//     try {
//       const result = await searchRecentTweets({
//         query: buildKeywordSearchQuery(termChunk),
//         maxResults: 50,
//       });
//       tweets = result.tweets;
//       users = result.users;
//     } catch (error) {
//       if (error instanceof XRateLimitError) {
//         rateLimited = true;
//         break;
//       }
//       console.error("[x-mentions] search failed", error);
//       continue;
//     }

//     const userById = new Map(users.map((u) => [u.id, u]));

//     for (const tweet of tweets) {
//       const author = userById.get(tweet.author_id);
//       if (!author) continue;
//       if (await isSpammy(author.id)) continue;

//       const account = await prisma.socialAccount.upsert({
//         where: { platform_externalId: { platform: "x", externalId: author.id } },
//         update: {
//           handle: author.username,
//           displayName: author.name,
//           avatarUrl: author.profile_image_url,
//           followerCount: author.public_metrics?.followers_count,
//           lastSeenAt: new Date(),
//         },
//         create: {
//           platform: "x",
//           externalId: author.id,
//           handle: author.username,
//           displayName: author.name,
//           avatarUrl: author.profile_image_url,
//           followerCount: author.public_metrics?.followers_count,
//         },
//       });

//       const post = await prisma.socialPost.upsert({
//         where: { platform_externalId: { platform: "x", externalId: tweet.id } },
//         update: {
//           likeCount: tweet.public_metrics?.like_count ?? 0,
//           replyCount: tweet.public_metrics?.reply_count ?? 0,
//           metricsUpdatedAt: new Date(),
//         },
//         create: {
//           platform: "x",
//           externalId: tweet.id,
//           socialAccountId: account.id,
//           content: tweet.text,
//           url: `https://x.com/${author.username}/status/${tweet.id}`,
//           extractedUrls: extractUrlsFromText(tweet.text),
//           postedAt: new Date(tweet.created_at),
//           likeCount: tweet.public_metrics?.like_count ?? 0,
//           replyCount: tweet.public_metrics?.reply_count ?? 0,
//           discoveredVia: "keyword_search",
//         },
//       });

//       // Figure out which term(s) in this chunk actually matched this
//       // tweet's text (X's OR query can return matches on any clause),
//       // then write one SocialMention per distinct workspace involved.
//       const matchingTerms = termChunk.filter((term) =>
//         tweet.text.toLowerCase().includes(term.toLowerCase())
//       );
//       const workspaceIds = new Set<string>();
//       const keywordIdsByWorkspace = new Map<string, string[]>();

//       for (const term of matchingTerms) {
//         for (const { workspaceId, keywordId } of keywordsByTerm.get(term) ?? []) {
//           workspaceIds.add(workspaceId);
//           const list = keywordIdsByWorkspace.get(workspaceId) ?? [];
//           list.push(keywordId);
//           keywordIdsByWorkspace.set(workspaceId, list);
//         }
//       }

//       for (const workspaceId of workspaceIds) {
//         const isBlocked = await prisma.accountBlocklist.findFirst({
//           where: { workspaceId, platform: "x", blockedAccountExternalId: author.id },
//         });
//         if (isBlocked) continue;

//         await prisma.socialMention.upsert({
//           where: { workspaceId_socialPostId: { workspaceId, socialPostId: post.id } },
//           update: {
//             matchedKeywordIds: keywordIdsByWorkspace.get(workspaceId) ?? [],
//           },
//           create: {
//             workspaceId,
//             socialPostId: post.id,
//             matchedKeywordIds: keywordIdsByWorkspace.get(workspaceId) ?? [],
//             firstMatchedAt: new Date(tweet.created_at),
//           },
//         });
//         mentionsWritten += 1;
//       }
//     }
//   }

//   return NextResponse.json({ ok: true, mentionsWritten, rateLimited });
// }

// FILE: app/api/cron/social/x-mentions/route.ts

/**
 * CHANGES FROM PREVIOUS VERSION:
 *
 * 1. Eligibility filter added (goals 1,2,3,4,6,9): candidate workspaceIds
 *    are pulled from SocialKeyword as before, but now immediately passed
 *    through getEligiblePlatformsByWorkspace() BEFORE any keyword is
 *    included in a search query. A Standard workspace's keyword, or a
 *    Growth workspace that hasn't connected X, is filtered out here —
 *    it can never reach searchRecentTweets(). This is the "immediately
 *    exit before calling any external API" defensive check (goal 3):
 *    the filter runs before the API-call loop even starts, not inside it.
 *
 * 2. Incremental sync added (goals 5,7,8): eligible workspaces are further
 *    narrowed to only those where isDueForSync(lastXSyncAt, "x") is true
 *    (30 min per workspace, see lib/social/sync-schedule.ts). A workspace
 *    searched 10 minutes ago will not be searched again even if this
 *    worker's QStash cron fires every 10 minutes — SAVINGS: ~66% fewer
 *    X API calls for this worker specifically (10 min -> 30 min cadence
 *    per workspace), on top of whatever fraction of workspaces are
 *    filtered out by step 1.
 *
 * 3. markSyncedBatch() called at the end for every workspace whose
 *    keyword(s) were actually included in a search this run — including
 *    ones that matched zero tweets, so a quiet workspace's "last synced"
 *    clock still advances and it isn't re-searched again before 30 min is up.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  searchRecentTweets,
  buildKeywordSearchQuery,
  XRateLimitError,
  type XTweet,
  type XUser,
} from "@/lib/social/x-api-client";
import { extractUrlsFromText } from "@/lib/social/url-utils";
import { tryConsumeQuota, trackMonthlyUsage } from "@/lib/social/rate-limiter";
import { getEligiblePlatformsByWorkspace } from "@/lib/billing/social-eligibility";
import { isDueForSync, markSyncedBatch } from "@/lib/social/sync-schedule";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

const KEYWORDS_PER_QUERY = 8;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function isSpammy(authorId: string): Promise<boolean> {
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { withinCap } = await trackMonthlyUsage({
    key: "x-api-reads",
    cap: Number(process.env.X_API_MONTHLY_READ_CAP ?? 10000),
  });
  if (!withinCap) {
    return NextResponse.json({ ok: false, reason: "monthly_cap_reached" });
  }

  const allKeywords = await prisma.socialKeyword.findMany({
    where: { isActive: true, platforms: { has: "x" } },
    select: { id: true, workspaceId: true, term: true },
  });

  if (allKeywords.length === 0) {
    return NextResponse.json({ ok: true, searched: 0 });
  }

  // ── Step 1: Growth + connected-to-X filter (goals 1,2,3,4,6,9) ─────────
  const candidateWorkspaceIds = Array.from(new Set(allKeywords.map((k) => k.workspaceId)));
  const eligibility = await getEligiblePlatformsByWorkspace(candidateWorkspaceIds);
  const xEligibleIds = new Set(
    Array.from(eligibility.entries())
      .filter(([, platforms]) => platforms.has("x"))
      .map(([id]) => id)
  );

  const eligibleKeywords = allKeywords.filter((k) => xEligibleIds.has(k.workspaceId));

  if (eligibleKeywords.length === 0) {
    return NextResponse.json({
      ok: true,
      searched: 0,
      skippedIneligible: allKeywords.length,
    });
  }

  // ── Step 2: due-for-sync filter, 30 min per workspace (goals 5,7,8) ────
  const eligibleWorkspaces = await prisma.workspace.findMany({
    where: { id: { in: Array.from(xEligibleIds) } },
    select: { id: true, lastXSyncAt: true },
  });

  const dueWorkspaceIds = new Set(
    eligibleWorkspaces.filter((w) => isDueForSync(w.lastXSyncAt, "x")).map((w) => w.id)
  );

  const dueKeywords = eligibleKeywords.filter((k) => dueWorkspaceIds.has(k.workspaceId));

  if (dueKeywords.length === 0) {
    return NextResponse.json({
      ok: true,
      searched: 0,
      skippedIneligible: allKeywords.length - eligibleKeywords.length,
      skippedNotDue: eligibleKeywords.length,
    });
  }

  // ── From here on, identical to before, but operating only on
  //    dueKeywords instead of the full unfiltered keyword list ───────────
  const keywordsByTerm = new Map<string, { workspaceId: string; keywordId: string }[]>();
  for (const kw of dueKeywords) {
    const list = keywordsByTerm.get(kw.term) ?? [];
    list.push({ workspaceId: kw.workspaceId, keywordId: kw.id });
    keywordsByTerm.set(kw.term, list);
  }

  const distinctTerms = Array.from(keywordsByTerm.keys());
  const termChunks = chunk(distinctTerms, KEYWORDS_PER_QUERY);

  let mentionsWritten = 0;
  let rateLimited = false;
  const processedWorkspaceIds = new Set<string>();

  for (const termChunk of termChunks) {
    const allowed = await tryConsumeQuota({
      key: "x-search-recent",
      limit: 60,
      windowSeconds: 900,
    });
    if (!allowed) {
      rateLimited = true;
      break;
    }

    let tweets: XTweet[] = [];
    let users: XUser[] = [];

    try {
      const result = await searchRecentTweets({
        query: buildKeywordSearchQuery(termChunk),
        maxResults: 50,
      });
      tweets = result.tweets;
      users = result.users;
    } catch (error) {
      if (error instanceof XRateLimitError) {
        rateLimited = true;
        break;
      }
      console.error("[x-mentions] search failed", error);
      continue;
    }

    for (const term of termChunk) {
      for (const { workspaceId } of keywordsByTerm.get(term) ?? []) {
        processedWorkspaceIds.add(workspaceId);
      }
    }

    const userById = new Map(users.map((u) => [u.id, u]));

    for (const tweet of tweets) {
      const author = userById.get(tweet.author_id);
      if (!author) continue;
      if (await isSpammy(author.id)) continue;

      const account = await prisma.socialAccount.upsert({
        where: { platform_externalId: { platform: "x", externalId: author.id } },
        update: {
          handle: author.username,
          displayName: author.name,
          avatarUrl: author.profile_image_url,
          followerCount: author.public_metrics?.followers_count,
          lastSeenAt: new Date(),
        },
        create: {
          platform: "x",
          externalId: author.id,
          handle: author.username,
          displayName: author.name,
          avatarUrl: author.profile_image_url,
          followerCount: author.public_metrics?.followers_count,
        },
      });

      const post = await prisma.socialPost.upsert({
        where: { platform_externalId: { platform: "x", externalId: tweet.id } },
        update: {
          likeCount: tweet.public_metrics?.like_count ?? 0,
          replyCount: tweet.public_metrics?.reply_count ?? 0,
          metricsUpdatedAt: new Date(),
        },
        create: {
          platform: "x",
          externalId: tweet.id,
          socialAccountId: account.id,
          content: tweet.text,
          url: `https://x.com/${author.username}/status/${tweet.id}`,
          extractedUrls: extractUrlsFromText(tweet.text),
          postedAt: new Date(tweet.created_at),
          likeCount: tweet.public_metrics?.like_count ?? 0,
          replyCount: tweet.public_metrics?.reply_count ?? 0,
          discoveredVia: "keyword_search",
        },
      });

      const matchingTerms = termChunk.filter((term) =>
        tweet.text.toLowerCase().includes(term.toLowerCase())
      );
      const workspaceIds = new Set<string>();
      const keywordIdsByWorkspace = new Map<string, string[]>();

      for (const term of matchingTerms) {
        for (const { workspaceId, keywordId } of keywordsByTerm.get(term) ?? []) {
          workspaceIds.add(workspaceId);
          const list = keywordIdsByWorkspace.get(workspaceId) ?? [];
          list.push(keywordId);
          keywordIdsByWorkspace.set(workspaceId, list);
        }
      }

      for (const workspaceId of workspaceIds) {
        const isBlocked = await prisma.accountBlocklist.findFirst({
          where: { workspaceId, platform: "x", blockedAccountExternalId: author.id },
        });
        if (isBlocked) continue;

        await prisma.socialMention.upsert({
          where: { workspaceId_socialPostId: { workspaceId, socialPostId: post.id } },
          update: {
            matchedKeywordIds: keywordIdsByWorkspace.get(workspaceId) ?? [],
          },
          create: {
            workspaceId,
            socialPostId: post.id,
            matchedKeywordIds: keywordIdsByWorkspace.get(workspaceId) ?? [],
            firstMatchedAt: new Date(tweet.created_at),
          },
        });
        mentionsWritten += 1;
      }
    }
  }

  await markSyncedBatch(Array.from(processedWorkspaceIds), "x");

  return NextResponse.json({
    ok: true,
    mentionsWritten,
    rateLimited,
    skippedIneligible: allKeywords.length - eligibleKeywords.length,
    skippedNotDue: eligibleKeywords.length - dueKeywords.length,
  });
}