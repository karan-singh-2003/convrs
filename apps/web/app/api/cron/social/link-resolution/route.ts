// FILE: app/api/cron/social/link-resolution/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRecentShortLinkReferers } from "@/lib/social/tinybird-client";
import { resolveShortUrl } from "@/lib/social/url-utils";

// TODO: replace this header check with QStash's official
// verifySignatureAppRouter() wrapper before going to production.
function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-worker-secret") === process.env.WORKER_SHARED_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const referers = await getRecentShortLinkReferers(10); // last 10 minutes

  let resolved = 0;
  let failed = 0;

  for (const row of referers) {
    if (!row.referer_url || !row.referer_url.startsWith("http")) continue;
    const result = await resolveShortUrl(row.referer_url);
    if (result) resolved += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, checked: referers.length, resolved, failed });
}