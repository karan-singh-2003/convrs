// apps/ingestion/src/controllers/dodo/webhook.ts
import { Request, Response } from "express";
import { Webhook } from "standardwebhooks";
import { prisma } from "@repo/db";
import { handlePaymentEvent } from "../shared/handle-payment.js";

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
    } else {
      console.log("[dodo/webhook] Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("[dodo/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};