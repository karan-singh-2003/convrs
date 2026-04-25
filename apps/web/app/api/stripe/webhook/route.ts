/**
 * app/api/webhooks/dodo/route.ts
 *
 * Uses dodo.webhooks.unwrap() from the SDK singleton (lib/dodo.ts) —
 * no separate `standardwebhooks` package needed.
 *
 * unwrap() verifies the signature AND returns the parsed event in one call.
 * For local testing with unsigned mock payloads from the Dodo dashboard
 * testing tool, swap unwrap() for unsafe_unwrap() temporarily.
 *
 * Subscribe to these events in Dashboard → Developers → Webhooks:
 *   subscription.active
 *   subscription.updated
 *   subscription.renewed
 *   subscription.plan_changed
 *   subscription.on_hold
 *   subscription.cancelled
 *   subscription.expired
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { dodo } from "@/lib/dodo";
import type {
  DodoWebhookEvent,
  DodoSubscriptionPayload,
} from "@/lib/dodo/types";
import { subscriptionActive } from "./subscription-active";
import { subscriptionUpdated } from "./subscription-updated";
import { subscriptionCancelled } from "./subscription-cancelled";
import { UnwrapWebhookEvent } from "dodopayments/resources/index.mjs";

const RELEVANT_EVENTS = new Set<DodoWebhookEvent["type"]>([
  "subscription.active",
  "subscription.updated",
  "subscription.renewed",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.expired",
]);

export async function POST(req: Request) {
  // ── 1. Read raw body as text (required for signature verification) ──────────
  const rawBody = await req.text();

  // ── 2. Extract Standard Webhooks headers ───────────────────────────────────
  const headersList = await headers();
  const webhookHeaders = {
    "webhook-id": headersList.get("webhook-id") ?? "",
    "webhook-signature": headersList.get("webhook-signature") ?? "",
    "webhook-timestamp": headersList.get("webhook-timestamp") ?? "",
  };

  // ── 3. Verify + parse via SDK (replaces the separate standardwebhooks call) ─
  let event: UnwrapWebhookEvent;
  try {
    // unwrap() verifies the HMAC signature and returns the parsed payload.
    // It uses the webhookKey you already passed to new DodoPayments({...}).
    // Throws on invalid/missing signature — Dodo will retry on our 400.
    event = dodo.webhooks.unwrap(rawBody, { headers: webhookHeaders });
  } catch (err) {
    console.error("[dodo/webhook] Signature verification failed:", err);
    return new Response("Webhook Error: Invalid signature", { status: 400 });
  }

  // ── 5. Dispatch ───────────────────────────────────────────────────────────
  try {
    const data = event.data;

    switch (event.type) {
      case "subscription.active":
        return await subscriptionActive(data);

      case "subscription.updated":
      case "subscription.renewed":
      case "subscription.plan_changed":
      case "subscription.on_hold":
        return await subscriptionUpdated(data);

      case "subscription.cancelled":
      case "subscription.expired":
        return await subscriptionCancelled(data);

      default:
        return NextResponse.json({ received: true });
    }
  } catch (err) {
    console.error(`[dodo/webhook] Error processing event ${event.type}:`, err);
    // 500 causes Dodo to retry — do not return 200 on processing errors.
    return new Response("Error processing event", { status: 500 });
  }
}
