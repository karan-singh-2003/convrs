// apps/ingestion/src/controllers/dodo/webhook.ts
import { Request, Response } from "express";
import { Webhook } from "standardwebhooks";
import { prisma } from "@repo/db";
import type { SubscriptionInterval } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";
import { handleSubscriptionEvent } from "../shared/handle-subscription.js";

type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

function mapDodoStatus(status: string | undefined): SubStatus {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "on_hold":
    case "failed":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
    case "canceled":
    case "expired":
      return "canceled";
    default:
      return "active";
  }
}

function normalizeDodoInterval(interval: unknown): SubscriptionInterval {
  const v = String(interval ?? "").toLowerCase();
  return v === "year" || v === "day" || v === "week"
    ? (v as SubscriptionInterval)
    : "month";
}

function toDodoDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dodoWebhookController = async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "dodo" } },
  });
  if (!integration?.webhookSecret) return res.status(404).json({ error: "Integration not found" });

  const webhook = new Webhook(integration.webhookSecret);
  const bodyStr = req.body.toString();

  let event: any;
  try {
    event = await webhook.verify(bodyStr, {
      "webhook-id": req.headers["webhook-id"] as string,
      "webhook-signature": req.headers["webhook-signature"] as string,
      "webhook-timestamp": req.headers["webhook-timestamp"] as string,
    });
  } catch (err) {
    console.error("[dodo/webhook] signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    if (event.type === "payment.succeeded") {
      const payment = event.data;
      await handlePaymentEvent({
        workspaceId,
        provider: "dodo",
        externalSessionId: payment.payment_id,
        externalEventId: req.headers["webhook-id"] as string,
        externalPaymentId: payment.payment_id,
        amount: payment.total_amount ?? 0,
        currency: (payment.currency ?? "usd").toLowerCase(),
        customerEmail: payment.customer?.email ?? null,
        visitorId: payment.metadata?.convrs_visitor_id ?? null,
        sessionId: payment.metadata?.convrs_session_id ?? null,
      });
    } else if (
      typeof event.type === "string" &&
      event.type.startsWith("subscription.")
    ) {
      const sub = event.data;
      const isCanceled =
        event.type === "subscription.cancelled" ||
        event.type === "subscription.expired" ||
        ["cancelled", "canceled", "expired"].includes(
          String(sub.status ?? "").toLowerCase()
        );

      await handleSubscriptionEvent({
        workspaceId,
        provider: "dodo",
        event:
          event.type === "subscription.active" && !sub.previous_billing_date
            ? "created"
            : isCanceled
              ? "canceled"
              : "updated",
        externalId: sub.subscription_id,
        externalCustomerId: sub.customer?.customer_id ?? null,
        status: mapDodoStatus(sub.status),
        amount: sub.recurring_pre_tax_amount ?? sub.amount ?? 0,
        currency: (sub.currency ?? "usd").toLowerCase(),
        interval: normalizeDodoInterval(sub.payment_frequency_interval),
        intervalCount: sub.payment_frequency_count ?? 1,
        plan: sub.product_id ?? sub.metadata?.plan ?? null,
        startedAt: toDodoDate(sub.created_at),
        canceledAt: toDodoDate(sub.cancelled_at),
        currentPeriodStart: toDodoDate(sub.previous_billing_date),
        currentPeriodEnd: toDodoDate(sub.next_billing_date),
        customerEmail: sub.customer?.email ?? null,
        visitorId: sub.metadata?.convrs_visitor_id ?? null,
        sessionId: sub.metadata?.convrs_session_id ?? null,
      });
    } else {
      console.log("[dodo/webhook] Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("[dodo/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};