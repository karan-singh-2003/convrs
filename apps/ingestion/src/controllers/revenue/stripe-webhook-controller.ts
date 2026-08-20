import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import { handlePaymentEvent } from "../shared/handle-payment.js";

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