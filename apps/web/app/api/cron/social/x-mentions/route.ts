// FILE: app/api/cron/social/x-mentions/route.ts
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
  // Placeholder spam heuristic — extend with account-age / duplicate-content
  // checks per the architecture doc's spam-filtering section. Kept minimal
  // here so the worker is functional end-to-end.
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

  const keywords = await prisma.socialKeyword.findMany({
    where: { isActive: true, platforms: { has: "x" } },
    select: { id: true, workspaceId: true, term: true },
  });

  if (keywords.length === 0) {
    return NextResponse.json({ ok: true, searched: 0 });
  }

  // Batch by distinct term (multiple workspaces tracking the same term
  // ride in one API call), then fan the results back out to every
  // workspace/keyword that term belongs to.
  const keywordsByTerm = new Map<string, { workspaceId: string; keywordId: string }[]>();
  for (const kw of keywords) {
    const list = keywordsByTerm.get(kw.term) ?? [];
    list.push({ workspaceId: kw.workspaceId, keywordId: kw.id });
    keywordsByTerm.set(kw.term, list);
  }

  const distinctTerms = Array.from(keywordsByTerm.keys());
  const termChunks = chunk(distinctTerms, KEYWORDS_PER_QUERY);

  let mentionsWritten = 0;
  let rateLimited = false;

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

      // Figure out which term(s) in this chunk actually matched this
      // tweet's text (X's OR query can return matches on any clause),
      // then write one SocialMention per distinct workspace involved.
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

  return NextResponse.json({ ok: true, mentionsWritten, rateLimited });
}