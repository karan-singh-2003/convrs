// apps/ingestion/src/controllers/polar/webhook.ts
import { Request, Response } from "express";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { prisma } from "@repo/db";
import { handlePaymentEvent } from "../shared/handle-payment.js";

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
    } else {
      console.log("[polar/webhook] Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("[polar/webhook] processing error:", err);
    return res.status(202).send("");
  }

  return res.status(202).send("");
};