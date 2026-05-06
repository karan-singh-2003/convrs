// app/api/dodo/webhook/route.ts

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";

import { subscriptionActive } from "./subscription-active";
import { subscriptionUpdated } from "./subscription-updated";
import { subscriptionCancelled } from "./subscription-cancelled";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT as any,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
});

const RELEVANT_EVENTS = new Set([
  "subscription.active",
  "subscription.updated",
  "subscription.renewed",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.expired",
]);

export async function POST(req: Request) {
  let event;

  try {
    // ── 1. RAW body (CRITICAL) ───────────────────────
    const rawBody = await req.text();

    // ── 2. Headers ───────────────────────────────────
    const headersList = headers();
    const webhookHeaders = {
      "webhook-id": (await headersList).get("webhook-id") ?? "",
      "webhook-signature": (await headersList).get("webhook-signature") ?? "",
      "webhook-timestamp": (await headersList).get("webhook-timestamp") ?? "",
    };

    // ── 3. Verify + parse ────────────────────────────
    event = client.webhooks.unwrap(rawBody, {
      headers: webhookHeaders,
    });

  } catch (err) {
    console.error("[dodo/webhook] Invalid signature:", err);
    return new Response("Invalid signature", { status: 401 });
  }

  // ── 4. Respond immediately ─────────────────────────
  const response = NextResponse.json({ received: true });

  // ── 5. Async processing (non-blocking) ─────────────
  processWebhookAsync(event).catch((err) => {
    console.error("[dodo/webhook] async error:", err);
  });

  return response;
}


// ─────────────────────────────────────────────────────
// Async processor
// ─────────────────────────────────────────────────────

async function processWebhookAsync(event: any) {
  try {
   

    if (!RELEVANT_EVENTS.has(event.type)) {
      return;
    }

    // safe because we filtered only subscription events
    const data = event.data as DodoSubscriptionPayload;

    switch (event.type) {
      case "subscription.active":
        await subscriptionActive(data);
        break;

      case "subscription.updated":
      case "subscription.renewed":
      case "subscription.plan_changed":
      case "subscription.on_hold":
        await subscriptionUpdated(data);
        break;

      case "subscription.cancelled":
      case "subscription.expired":
        await subscriptionCancelled(data);
        break;

      default:
        break;
    }

  } catch (err) {
    console.error(
      `[dodo/webhook] processing error (${event.type}):`,
      err
    );
  }
}