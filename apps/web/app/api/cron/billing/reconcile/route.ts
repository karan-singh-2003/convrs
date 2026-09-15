// app/api/cron/billing/reconcile/route.ts
//
// Deploy 4 — hourly self-heal for Convrs's own subscription billing
// (docs/billing-implementation-plan.md §10). Re-derives our Subscription rows
// and Workspace cache from live Dodo state, fixing drift from missed/late/failed
// webhooks. Vercel Cron auth via CRON_SECRET.

import { NextResponse } from "next/server";
import { reconcileBilling } from "@/lib/billing/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const report = await reconcileBilling();
    if (report.errors.length) {
      console.error("[cron/billing/reconcile] completed with errors", report.errors);
    }
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[cron/billing/reconcile] failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
