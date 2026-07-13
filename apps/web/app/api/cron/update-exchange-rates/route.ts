// app/api/cron/update-exchange-rates/route.ts
import { updateExchangeRates } from "@/lib/currency/update-rates";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  await updateExchangeRates();
  return NextResponse.json({ ok: true });
}