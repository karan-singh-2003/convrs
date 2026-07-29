// FILE: app/api/[slug]/social/activity/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { z } from "zod";

const activityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUTC - date.getTime();
}

function getUtcRangeForLocalDate(dateStr: string, timeZone: string) {
  const naiveStart = new Date(`${dateStr}T00:00:00.000Z`);
  const offsetMs = getTimezoneOffsetMs(naiveStart, timeZone);
  const start = new Date(naiveStart.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function getProfileUrl(platform: "x" | "reddit", handle: string): string {
  return platform === "reddit" ? `https://reddit.com/user/${handle}` : `https://x.com/${handle}`;
}

export const GET = withWorkspace(
  async ({ searchParams, workspace }) => {
    const { date: dateParam } = activityQuerySchema.parse(searchParams);
    const { start, end } = getUtcRangeForLocalDate(dateParam, workspace.timezone);

    const [attributions, mentions] = await Promise.all([
      prisma.linkAttribution.findMany({
        where: { workspaceId: workspace.id, matchedAt: { gte: start, lte: end } },
        orderBy: { matchedAt: "desc" },
        include: { socialAccount: true, socialPost: true },
        take: 500,
      }),
      prisma.socialMention.findMany({
        where: {
          workspaceId: workspace.id,
          isHidden: false,
          firstMatchedAt: { gte: start, lte: end },
        },
        orderBy: { firstMatchedAt: "desc" },
        include: { socialPost: { include: { socialAccount: true } } },
        take: 500,
      }),
    ]);

    const attributionCards = new Map<
      string,
      {
        id: string;
        kind: "attribution";
        platform: "x" | "reddit";
        handle: string;
        displayName: string | null;
        avatarUrl: string | null;
        content: string | null;
        postUrl: string | null;
        profileUrl: string;
        likeCount: number;
        replyCount: number;
        confidence: "high" | "medium" | "low";
        matchMethod: "exact_url" | "fuzzy_url" | "link_in_bio";
        visitorIds: Set<string>;
        timestamp: number;
      }
    >();

    for (const attribution of attributions) {
      const account = attribution.socialAccount;
      const post = attribution.socialPost;
      const groupKey = post ? `post:${post.id}` : `account:${account.id}`;

      let card = attributionCards.get(groupKey);
      if (!card) {
        card = {
          id: groupKey,
          kind: "attribution",
          platform: account.platform,
          handle: account.handle,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          content: post?.content ?? null,
          postUrl: post?.url ?? null,
          profileUrl: getProfileUrl(account.platform, account.handle),
          likeCount: post?.likeCount ?? 0,
          replyCount: post?.replyCount ?? 0,
          confidence: attribution.confidence,
          matchMethod: attribution.matchMethod,
          visitorIds: new Set(),
          timestamp: attribution.matchedAt.getTime(),
        };
        attributionCards.set(groupKey, card);
      }
      card.visitorIds.add(attribution.visitorId);
    }

    const mentionCards = mentions.map((mention) => {
      const post = mention.socialPost;
      const account = post.socialAccount;
      return {
        id: `mention:${mention.id}`,
        kind: "mention" as const,
        platform: post.platform,
        handle: account.handle,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        content: post.content,
        postUrl: post.url,
        profileUrl: getProfileUrl(post.platform, account.handle),
        likeCount: post.likeCount,
        replyCount: post.replyCount,
        timestamp: mention.firstMatchedAt.getTime(),
      };
    });

    const data = [
      ...Array.from(attributionCards.values()).map((card) => ({
        id: card.id,
        kind: card.kind,
        platform: card.platform,
        handle: card.handle,
        displayName: card.displayName,
        avatarUrl: card.avatarUrl,
        content: card.content,
        postUrl: card.postUrl,
        profileUrl: card.profileUrl,
        likeCount: card.likeCount,
        replyCount: card.replyCount,
        confidence: card.confidence,
        matchMethod: card.matchMethod,
        visitorCount: card.visitorIds.size,
        timestamp: card.timestamp,
      })),
      ...mentionCards,
    ].sort((a, b) => b.timestamp - a.timestamp);

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "analytics.read" }
);