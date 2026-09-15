import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import type { SubscriptionInterval } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";
import { handleSubscriptionEvent } from "../shared/handle-subscription.js";

type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

function mapStripeStatus(status: string, deleted: boolean): SubStatus {
  if (deleted) return "canceled";
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    // incomplete / incomplete_expired / canceled — not contributing to MRR
    default:
      return "canceled";
  }
}

function normalizeInterval(interval: string | undefined): SubscriptionInterval {
  if (interval === "day" || interval === "week" || interval === "year") return interval;
  return "month";
}

export const stripeWebhookController = async (req: Request, res: Response) => {
  const workspaceId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const sigHeader = req.headers["stripe-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });
  if (!sig) return res.status(400).json({ error: "Missing stripe-signature" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "stripe" } },
  });

  if (!integration?.webhookSecret) return res.status(404).json({ error: "Integration not found" });

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(decrypt(integration.apiKeyEncrypted!), { apiVersion: "2026-01-28.clover" });
    event = stripe.webhooks.constructEvent(req.body, sig, integration.webhookSecret);
  } catch (err: any) {
    console.error("[stripe/webhook] signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handlePaymentEvent({
        workspaceId,
        provider: "stripe",
        externalSessionId: session.id,
        externalEventId: event.id,
        externalPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        customerEmail: session.customer_details?.email ?? null,
        visitorId: session.metadata?.convrs_visitor_id ?? null,
        sessionId: session.metadata?.convrs_session_id ?? null,
        isRecurring: session.mode === "subscription",
      });
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const deleted = event.type === "customer.subscription.deleted";
      const item = sub.items?.data?.[0];
      const price = item?.price;

      const amount = (sub.items?.data ?? []).reduce(
        (sum, it) => sum + (it.price?.unit_amount ?? 0) * (it.quantity ?? 1),
        0
      );
      const toDate = (secs: number | null | undefined) =>
        secs ? new Date(secs * 1000) : null;

      await handleSubscriptionEvent({
        workspaceId,
        provider: "stripe",
        event: deleted
          ? "canceled"
          : event.type === "customer.subscription.created"
            ? "created"
            : "updated",
        externalId: sub.id,
        externalCustomerId:
          typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
        status: mapStripeStatus(sub.status, deleted),
        amount,
        currency: price?.currency ?? sub.currency ?? "usd",
        interval: normalizeInterval(price?.recurring?.interval),
        intervalCount: price?.recurring?.interval_count ?? 1,
        plan: price?.nickname ?? price?.id ?? null,
        startedAt: toDate(sub.start_date) ?? toDate((sub as any).created),
        canceledAt: toDate(sub.canceled_at),
        currentPeriodStart: toDate(
          (item as any)?.current_period_start ?? (sub as any).current_period_start
        ),
        currentPeriodEnd: toDate(
          (item as any)?.current_period_end ?? (sub as any).current_period_end
        ),
        visitorId: sub.metadata?.convrs_visitor_id ?? null,
        sessionId: sub.metadata?.convrs_session_id ?? null,
      });
    } else {
      console.log("Unhandled event:", event.type);
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] processing error for ${event.type}:`, err);
    return res.status(200).json({ error: "Processing failed" }); // avoid retry storms
  }

  return res.json({ received: true });
};