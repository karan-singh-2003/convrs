// apps/ingestion/src/controllers/paddle/webhook.ts
import { Request, Response } from "express";
import { Paddle } from "@paddle/paddle-node-sdk";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";

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
    } else {
      console.log("[paddle/webhook] Unhandled event:", event.eventType);
    }
  } catch (err) {
    console.error("[paddle/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};