// FILE: app/api/workspaces/[idOrSlug]/social/activity-timeline/route.ts
import { withWorkspace } from "@/lib/auth";
import { getAnalyticsBucketKey, getStartEndDates } from "@/lib/analytics/utils";
import { prisma } from "@repo/db";
import { z } from "zod";

const activityTimelineQuerySchema = z.object({
  interval: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  timezone: z.string().optional(),
});

type PreviewItem = {
  kind: "attribution" | "mention";
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  platform: "x" | "reddit";
  content: string | null;
  likeCount: number;
  sortTime: number;
};

type DateBucket = {
  avatarOrder: string[];
  accountById: Map<string, { handle: string; avatarUrl: string | null }>;
  seenAccountIds: Set<string>;
  previews: PreviewItem[];
  totalActivityCount: number;
  uniqueVisitorCount: Set<string>;
};

function newBucket(): DateBucket {
  return {
    avatarOrder: [],
    accountById: new Map(),
    seenAccountIds: new Set(),
    previews: [],
    totalActivityCount: 0,
    uniqueVisitorCount: new Set(),
  };
}

function touchAccount(bucket: DateBucket, accountId: string, handle: string, avatarUrl: string | null) {
  if (!bucket.seenAccountIds.has(accountId)) {
    bucket.seenAccountIds.add(accountId);
    bucket.avatarOrder.push(accountId);
    bucket.accountById.set(accountId, { handle, avatarUrl });
  }
}

export const GET = withWorkspace(
  async ({ searchParams, workspace }) => {
    const {
      interval,
      start: startParam,
      end: endParam,
      timezone: tzParam,
    } = activityTimelineQuerySchema.parse(searchParams);

    const timezone = tzParam || workspace.timezone || "UTC";

    const { startDate, endDate, granularity } = getStartEndDates({
      interval,
      start: startParam,
      end: endParam,
      timezone,
    });

    const [attributions, mentions] = await Promise.all([
      prisma.linkAttribution.findMany({
        where: { workspaceId: workspace.id, matchedAt: { gte: startDate, lte: endDate } },
        orderBy: { matchedAt: "desc" },
        include: { socialAccount: true, socialPost: true },
        take: 5000,
      }),
      prisma.socialMention.findMany({
        where: {
          workspaceId: workspace.id,
          isHidden: false,
          firstMatchedAt: { gte: startDate, lte: endDate },
        },
        orderBy: { firstMatchedAt: "desc" },
        include: { socialPost: { include: { socialAccount: true } } },
        take: 5000,
      }),
    ]);

    const byDate = new Map<string, DateBucket>();

    for (const attribution of attributions) {
      const dateKey = getAnalyticsBucketKey(attribution.matchedAt, granularity, timezone);
      const bucket = byDate.get(dateKey) ?? newBucket();
      byDate.set(dateKey, bucket);

      bucket.totalActivityCount += 1;
      bucket.uniqueVisitorCount.add(attribution.visitorId);

      const account = attribution.socialAccount;
      touchAccount(bucket, account.id, account.handle, account.avatarUrl);

      bucket.previews.push({
        kind: "attribution",
        handle: account.handle,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        platform: account.platform,
        content: attribution.socialPost?.content ?? null,
        likeCount: attribution.socialPost?.likeCount ?? 0,
        sortTime: attribution.matchedAt.getTime(),
      });
    }

    for (const mention of mentions) {
      const post = mention.socialPost;
      const account = post.socialAccount;
      const dateKey = getAnalyticsBucketKey(mention.firstMatchedAt, granularity, timezone);
      const bucket = byDate.get(dateKey) ?? newBucket();
      byDate.set(dateKey, bucket);

      bucket.totalActivityCount += 1;
      touchAccount(bucket, account.id, account.handle, account.avatarUrl);

      bucket.previews.push({
        kind: "mention",
        handle: account.handle,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        platform: post.platform,
        content: post.content,
        likeCount: post.likeCount,
        sortTime: mention.firstMatchedAt.getTime(),
      });
    }

    const data = Array.from(byDate.entries()).map(([date, bucket]) => {
      const avatars = bucket.avatarOrder
        .slice(0, 3)
        .map((id) => bucket.accountById.get(id)!.avatarUrl)
        .filter((url): url is string => Boolean(url));

      const handles = bucket.avatarOrder.slice(0, 3).map((id) => bucket.accountById.get(id)!.handle);

      const previewItems = [...bucket.previews]
        .sort((a, b) => {
          const aHasContent = a.content ? 1 : 0;
          const bHasContent = b.content ? 1 : 0;
          if (aHasContent !== bHasContent) return bHasContent - aHasContent;
          return b.sortTime - a.sortTime;
        })
        .slice(0, 2)
        .map(({ sortTime, ...rest }) => rest);

      return {
        date,
        avatars,
        handles,
        uniqueProfileCount: bucket.seenAccountIds.size,
        totalActivityCount: bucket.totalActivityCount,
        uniqueVisitorCount: bucket.uniqueVisitorCount.size,
        previewItems,
      };
    });

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "analytics.read" }
);