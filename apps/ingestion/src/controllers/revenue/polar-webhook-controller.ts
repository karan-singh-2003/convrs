// apps/ingestion/src/controllers/polar/webhook.ts
import { Request, Response } from "express";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { prisma } from "@repo/db";
import type { SubscriptionInterval } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";
import { handleSubscriptionEvent } from "../shared/handle-subscription.js";

type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

function mapPolarStatus(status: string | undefined, ended: boolean): SubStatus {
  if (ended) return "canceled";
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "revoked":
      return "canceled";
    default:
      return "active";
  }
}

function normalizePolarInterval(interval: unknown): SubscriptionInterval {
  return interval === "year" || interval === "day" || interval === "week"
    ? interval
    : "month";
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function flattenHeaders(headers: Request["headers"]): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value.length > 0) flat[key] = value[0];
  }
  return flat;
}

function metadataToString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : String(value);
}

export const polarWebhookController = async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "polar" } },
  });
  if (!integration?.webhookSecret) return res.status(404).json({ error: "Integration not found" });

  let event;
  try {
    event = validateEvent(req.body, flattenHeaders(req.headers), integration.webhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.error("[polar/webhook] signature verification failed");
      return res.status(403).json({ error: "Invalid signature" });
    }
    throw err;
  }

  try {
    if (event.type === "order.paid") {
      const order = event.data;
      await handlePaymentEvent({
        workspaceId,
        provider: "polar",
        externalSessionId: order.checkoutId ?? order.id,
        externalEventId: `${order.id}:${event.type}`,
        externalPaymentId: order.id,
        amount: order.totalAmount ?? 0,
        currency: (order.currency ?? "usd").toLowerCase(),
        customerEmail: order.customer?.email ?? null,
        visitorId: metadataToString(order.metadata?.convrs_visitor_id),
        sessionId: metadataToString(order.metadata?.convrs_session_id),
      });
    } else if (
      event.type === "subscription.created" ||
      event.type === "subscription.updated" ||
      event.type === "subscription.active" ||
      event.type === "subscription.canceled" ||
      event.type === "subscription.revoked" ||
      event.type === "subscription.uncanceled"
    ) {
      const sub = event.data as any;
      const ended =
        event.type === "subscription.revoked" || Boolean(sub.endedAt);

      await handleSubscriptionEvent({
        workspaceId,
        provider: "polar",
        event:
          event.type === "subscription.created"
            ? "created"
            : event.type === "subscription.canceled" ||
                event.type === "subscription.revoked"
              ? "canceled"
              : "updated",
        externalId: sub.id,
        externalCustomerId: sub.customerId ?? sub.customer?.id ?? null,
        status: mapPolarStatus(sub.status, ended),
        amount: sub.amount ?? sub.price?.priceAmount ?? sub.recurringAmount ?? 0,
        currency: sub.currency ?? "usd",
        interval: normalizePolarInterval(
          sub.recurringInterval ?? sub.recurring_interval
        ),
        intervalCount: 1,
        plan: sub.product?.name ?? sub.productPrice?.product?.name ?? null,
        startedAt: toDate(sub.startedAt) ?? toDate(sub.createdAt),
        canceledAt: toDate(sub.canceledAt) ?? toDate(sub.endedAt),
        currentPeriodStart: toDate(sub.currentPeriodStart),
        currentPeriodEnd: toDate(sub.currentPeriodEnd),
        customerEmail: sub.customer?.email ?? null,
        visitorId: metadataToString(sub.metadata?.convrs_visitor_id),
        sessionId: metadataToString(sub.metadata?.convrs_session_id),
      });
    } else {
      console.log("[polar/webhook] Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("[polar/webhook] processing error:", err);
    return res.status(202).send("");
  }

  return res.status(202).send("");
};