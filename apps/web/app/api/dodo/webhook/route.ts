// app/api/dodo/webhook/route.ts
//
// Convrs's own subscription-billing webhook. Rewritten in Deploy 2:
//   - dedup via the DodoWebhookEvent table (webhook-id header)
//   - single transactional processor (lib/billing/webhook-processor.ts)
//   - AWAITED, not fire-and-forget
//   - transient failure -> 500 so Dodo retries (≤8×, exp backoff)
//
// (Customer-revenue webhooks — Stripe/Polar/Paddle/LemonSqueezy/Dodo for a
// workspace's OWN payment processor — are handled in apps/ingestion, not here.)

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { dodo } from "@/lib/dodo";
import { processWebhookEvent, RELEVANT_EVENTS } from "@/lib/billing/webhook-processor";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";

const PROCESSING_TTL_MS = 15_000;

export async function POST(req: Request) {
  // ── 1. verify signature ──────────────────────────────────────────────
  let event: { type: string; timestamp: string; data: Record<string, unknown> };
  const rawBody = await req.text();
  const h = await headers();
  const webhookId = h.get("webhook-id") ?? "";

  try {
    event = dodo.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": h.get("webhook-signature") ?? "",
        "webhook-timestamp": h.get("webhook-timestamp") ?? "",
      },
    }) as unknown as typeof event;
  } catch (err) {
    console.error("[dodo/webhook] invalid signature", err);
    return new Response("Invalid signature", { status: 401 });
  }

  if (!webhookId) {
    console.error("[dodo/webhook] missing webhook-id header");
    return new Response("Missing webhook-id", { status: 400 });
  }

  const data = event.data as unknown as DodoSubscriptionPayload;
  const dodoSubscriptionId =
    typeof data?.subscription_id === "string" ? data.subscription_id : null;

  // ── 2. dedup ─────────────────────────────────────────────────────────
  const inserted = await prisma.dodoWebhookEvent.createMany({
    data: [{ webhookId, eventType: event.type, dodoSubscriptionId, status: "processing" }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    const existing = await prisma.dodoWebhookEvent.findUnique({ where: { webhookId } });
    if (existing?.status === "done") return jsonOk();
    if (
      existing?.status === "processing" &&
      Date.now() - existing.receivedAt.getTime() < PROCESSING_TTL_MS
    ) {
      return jsonOk(); // another worker holds it
    }
    // stale processing / failed → take over
    await prisma.dodoWebhookEvent.update({
      where: { webhookId },
      data: { attempts: { increment: 1 }, status: "processing", error: null },
    });
  }

  // ── 3. irrelevant events → ack ───────────────────────────────────────
  if (!RELEVANT_EVENTS.has(event.type)) {
    await prisma.dodoWebhookEvent.update({
      where: { webhookId },
      data: { status: "done", processedAt: new Date() },
    });
    return jsonOk();
  }

  // ── 4. process (awaited, transactional) ──────────────────────────────
  try {
    await processWebhookEvent(
      { type: event.type, timestamp: event.timestamp, data },
      webhookId,
    );
    return jsonOk();
  } catch (err) {
    console.error(`[dodo/webhook] processing failed (${event.type})`, err);
    await prisma.dodoWebhookEvent
      .update({ where: { webhookId }, data: { status: "failed", error: String(err).slice(0, 900) } })
      .catch(() => {});
    return new Response("Processing failed", { status: 500 }); // Dodo retries
  }
}

function jsonOk() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
