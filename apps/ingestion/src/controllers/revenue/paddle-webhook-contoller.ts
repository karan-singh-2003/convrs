// apps/ingestion/src/controllers/paddle/webhook.ts
import { Request, Response } from "express";
import { Paddle } from "@paddle/paddle-node-sdk";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import type { SubscriptionInterval } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";
import { handleSubscriptionEvent } from "../shared/handle-subscription.js";

type SubStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

function mapPaddleStatus(status: string | undefined): SubStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    default:
      return "active";
  }
}

function normalizePaddleInterval(interval: unknown): SubscriptionInterval {
  return interval === "year" || interval === "day" || interval === "week"
    ? interval
    : "month";
}

function toPaddleDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function customDataToString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : String(value);
}

export const paddleWebhookController = async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

  const signature = req.headers["paddle-signature"] as string | undefined;
  if (!signature) return res.status(400).json({ error: "Missing Paddle-Signature" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "paddle" } },
  });
  if (!integration?.webhookSecret || !integration.apiKeyEncrypted) {
    return res.status(404).json({ error: "Integration not found" });
  }

  const apiKey = decrypt(integration.apiKeyEncrypted);
  const paddle = new Paddle(apiKey);
  const rawBody: string = (req.body as Buffer).toString();

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, integration.webhookSecret, signature);
  } catch (err) {
    console.error("[paddle/webhook] signature verification failed:", err);
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    if (event.eventType === "transaction.completed") {
      const txn = event.data;
      const totals = txn.details?.totals;
      const customData = txn.customData as Record<string, unknown> | null | undefined;

      let customerEmail: string | null = null;
      if (txn.customerId) {
        try {
          const customer = await paddle.customers.get(txn.customerId);
          customerEmail = customer.email ?? null;
        } catch (err) {
          console.warn(`[paddle/webhook] Failed to fetch customer ${txn.customerId}:`, err);
        }
      }

      await handlePaymentEvent({
        workspaceId,
        provider: "paddle",
        externalSessionId: txn.id,
        externalEventId: event.eventId,
        externalPaymentId: txn.id,
        amount: Number(totals?.total ?? 0),
        currency: (totals?.currencyCode ?? "USD").toLowerCase(),
        customerEmail,
        visitorId: customDataToString(customData?.convrs_visitor_id),
        sessionId: customDataToString(customData?.convrs_session_id),
      });
    } else if (
      typeof event.eventType === "string" &&
      event.eventType.startsWith("subscription.")
    ) {
      const sub = event.data as any;
      const items: any[] = Array.isArray(sub.items) ? sub.items : [];

      const amount = items.reduce(
        (sum, it) =>
          sum +
          Number(it?.price?.unitPrice?.amount ?? it?.unitPrice?.amount ?? 0) *
            (it?.quantity ?? 1),
        0
      );

      const isCanceled =
        event.eventType === "subscription.canceled" || sub.status === "canceled";

      await handleSubscriptionEvent({
        workspaceId,
        provider: "paddle",
        event:
          event.eventType === "subscription.created"
            ? "created"
            : isCanceled
              ? "canceled"
              : "updated",
        externalId: sub.id,
        externalCustomerId: sub.customerId ?? null,
        status: mapPaddleStatus(sub.status),
        amount,
        currency: sub.currencyCode ?? "USD",
        interval: normalizePaddleInterval(sub.billingCycle?.interval),
        intervalCount: sub.billingCycle?.frequency ?? 1,
        plan: items[0]?.price?.name ?? items[0]?.product?.name ?? null,
        startedAt:
          toPaddleDate(sub.startedAt) ??
          toPaddleDate(sub.firstBilledAt) ??
          toPaddleDate(sub.createdAt),
        canceledAt: toPaddleDate(sub.canceledAt),
        currentPeriodStart: toPaddleDate(sub.currentBillingPeriod?.startsAt),
        currentPeriodEnd: toPaddleDate(sub.currentBillingPeriod?.endsAt),
        visitorId: customDataToString(
          (sub.customData as Record<string, unknown> | null | undefined)
            ?.convrs_visitor_id
        ),
        sessionId: customDataToString(
          (sub.customData as Record<string, unknown> | null | undefined)
            ?.convrs_session_id
        ),
      });
    } else {
      console.log("[paddle/webhook] Unhandled event:", event.eventType);
    }
  } catch (err) {
    console.error("[paddle/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};