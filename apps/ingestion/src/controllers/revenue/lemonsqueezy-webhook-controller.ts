// apps/ingestion/src/controllers/lemonsqueezy/webhook.ts
import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import type { SubscriptionInterval } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";
import { handleSubscriptionEvent } from "../shared/handle-subscription.js";

type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

function mapLsStatus(status: string | undefined): SubStatus {
  switch (status) {
    case "active":
      return "active";
    case "on_trial":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
    case "expired":
      return "canceled";
    default:
      return "active";
  }
}

function toLsDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The LemonSqueezy subscription webhook payload does not carry the plan price
 * or billing interval — only a `price_id`. Fetch the price object so MRR is
 * accurate. Returns null if no API key is configured (MRR then can't include
 * this subscription).
 */
async function fetchLsPrice(
  priceId: string | undefined,
  apiKeyEncrypted: string | null
): Promise<{ amount: number; interval: SubscriptionInterval; intervalCount: number } | null> {
  if (!priceId || !apiKeyEncrypted) return null;
  try {
    const res = await fetch(`https://api.lemonsqueezy.com/v1/prices/${priceId}`, {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${decrypt(apiKeyEncrypted)}`,
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const attrs = body?.data?.attributes ?? {};
    const unit = attrs.unit_price ?? attrs.unit_price_decimal ?? 0;
    const rawInterval = attrs.renewal_interval_unit as string | undefined;
    const interval: SubscriptionInterval =
      rawInterval === "year" || rawInterval === "day" || rawInterval === "week"
        ? rawInterval
        : "month";
    return {
      amount: Number(unit) || 0,
      interval,
      intervalCount: attrs.renewal_interval_quantity ?? 1,
    };
  } catch (err) {
    console.warn("[lemonsqueezy/webhook] price lookup failed:", err);
    return null;
  }
}

export const lemonsqueezyWebhookController = async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

  const sig = req.headers["x-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "Missing X-Signature" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "lemonsqueezy" } },
  });
  if (!integration?.webhookSecret) return res.status(404).json({ error: "Integration not found" });

  const rawBody: Buffer = req.body;
  const expected = crypto.createHmac("sha256", integration.webhookSecret).update(rawBody).digest("hex");

  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error("[lemonsqueezy/webhook] signature verification failed");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(rawBody.toString());
  const eventName = payload.meta?.event_name;

  try {
    if (eventName === "order_created") {
      const order = payload.data.attributes;
      const customData = payload.meta?.custom_data ?? {};
      await handlePaymentEvent({
        workspaceId,
        provider: "lemonsqueezy",
        externalSessionId: payload.data.id,
        externalEventId: `${payload.data.id}:${eventName}`,
        externalPaymentId: payload.data.id,
        amount: order.total ?? 0, // already in cents
        currency: (order.currency ?? "usd").toLowerCase(),
        customerEmail: order.user_email ?? null,
        visitorId: customData.convrs_visitor_id ?? null,
        sessionId: customData.convrs_session_id ?? null,
      });
    } else if (
      typeof eventName === "string" &&
      eventName.startsWith("subscription_") &&
      !eventName.startsWith("subscription_payment") &&
      !eventName.startsWith("subscription_plan_changed")
    ) {
      const attrs = payload.data.attributes;
      const customData = payload.meta?.custom_data ?? {};
      const price = await fetchLsPrice(
        attrs.first_subscription_item?.price_id
          ? String(attrs.first_subscription_item.price_id)
          : undefined,
        integration.apiKeyEncrypted ?? null
      );
      const isCanceled =
        eventName === "subscription_cancelled" ||
        eventName === "subscription_expired" ||
        ["cancelled", "expired"].includes(attrs.status);

      await handleSubscriptionEvent({
        workspaceId,
        provider: "lemonsqueezy",
        event:
          eventName === "subscription_created"
            ? "created"
            : isCanceled
              ? "canceled"
              : "updated",
        externalId: String(payload.data.id),
        externalCustomerId:
          attrs.customer_id != null ? String(attrs.customer_id) : null,
        status: mapLsStatus(attrs.status),
        amount: price?.amount ?? 0,
        currency: (attrs.currency ?? "usd").toLowerCase(),
        interval: price?.interval ?? "month",
        intervalCount: price?.intervalCount ?? 1,
        plan: attrs.variant_name ?? attrs.product_name ?? null,
        startedAt: toLsDate(attrs.created_at),
        canceledAt: isCanceled ? toLsDate(attrs.ends_at ?? attrs.updated_at) : null,
        currentPeriodEnd: toLsDate(attrs.renews_at),
        customerEmail: attrs.user_email ?? null,
        visitorId: customData.convrs_visitor_id ?? null,
        sessionId: customData.convrs_session_id ?? null,
      });
    } else {
      console.log("[lemonsqueezy/webhook] Unhandled event:", eventName);
    }
  } catch (err) {
    console.error("[lemonsqueezy/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};