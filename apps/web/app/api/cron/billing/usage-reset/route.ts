// app/api/cron/billing/usage-reset/route.ts
//
// Deploy 4 — daily backstop for the per-billing-period usage reset (D8). The
// primary trigger is the `subscription.renewed` webhook; this catches any
// subscription whose period rolled over without (or before) that webhook
// landing. Vercel Cron auth via CRON_SECRET.

import { NextResponse } from "next/server";
import { resetLapsedUsagePeriods } from "@/lib/billing/usage-reset";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const report = await resetLapsedUsagePeriods();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[cron/billing/usage-reset] failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
