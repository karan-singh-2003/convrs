// FILE: app/api/cron/social/attribution-reconciliation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
import { normalizeUrl, resolveShortUrl, parseProfileReferer } from "@/lib/social/url-utils";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Wider window than the Link Resolution Worker's — this catches
  // attribution for tweets that were only discovered *after* the
  // original clicks came in (the whole point of reconciliation).
  const referers = await getRecentShortLinkReferers(60 * 48);

  let matched = 0;
  let skipped = 0;

  for (const row of referers) {
    const alreadyAttributed = await prisma.linkAttribution.findUnique({
      where: { eventId: row.event_id },
      select: { id: true },
    });
    if (alreadyAttributed) {
      skipped += 1;
      continue;
    }

    // ── Case 1: link-in-bio (referer is a bare profile URL) ──────────
    const profileRef = parseProfileReferer(row.referer_url);
    if (profileRef) {
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
              // We don't have the platform's numeric ID from a bare
              // referer URL — key on handle instead for this path.
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

    // ── Case 2: exact-URL match against a discovered tweet ───────────
    const resolvedUrl = await resolveShortUrl(row.referer_url);
    if (!resolvedUrl) {
      skipped += 1;
      continue;
    }

    const normalized = normalizeUrl(resolvedUrl);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    const candidates = await prisma.socialPost.findMany({
      where: { extractedUrls: { has: normalized }, status: "active" },
      include: { socialAccount: true },
    });

    if (candidates.length === 0) {
      skipped += 1;
      continue;
    }

    const clickTime = new Date(row.timestamp).getTime();
    const best = candidates.reduce((closest, candidate) => {
      const diff = Math.abs(candidate.postedAt.getTime() - clickTime);
      const closestDiff = Math.abs(closest.postedAt.getTime() - clickTime);
      return diff < closestDiff ? candidate : closest;
    }, candidates[0]);

    await prisma.linkAttribution.create({
      data: {
        workspaceId: row.workspace_id,
        eventId: row.event_id,
        visitorId: row.visitor_id,
        socialAccountId: best.socialAccountId,
        socialPostId: best.id,
        confidence: candidates.length === 1 ? "high" : "medium",
        confidenceScore: candidates.length === 1 ? 0.95 : 0.6,
        matchMethod: "exact_url",
        matchedAt: new Date(row.timestamp),
      },
    });
    matched += 1;
  }

  return NextResponse.json({ ok: true, checked: referers.length, matched, skipped });
}