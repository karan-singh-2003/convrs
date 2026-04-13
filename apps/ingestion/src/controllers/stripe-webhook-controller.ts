import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "@repo/db";
import { decrypt } from "@repo/analytics";
import { handleCheckoutCompleted } from "./handle-checkout-complete";
import { handleChargeSucceeded } from "./handle-charge-succeeded";

export const stripeWebhookController = async (req: Request, res: Response) => {
  const workspaceIdParam = req.params.workspaceId;
  const workspaceId = Array.isArray(workspaceIdParam)
    ? workspaceIdParam[0]
    : workspaceIdParam;
  const sigHeader = req.headers["stripe-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  if (!workspaceId) {
    return res.status(400).json({ error: "Missing workspaceId" });
  }

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  // Load integration
  const integration = await prisma.stripeIntegration.findFirst({
    where: { workspaceId: workspaceId },
  });

  if (!integration) {
    return res.status(404).json({ error: "Integration not found" });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(decrypt(integration.apiKeyEncrypted), {
      apiVersion: "2026-01-28.clover",
    });

    console.log(`[stripe/webhook] verifying signature for workspace ${workspaceId} using secret ${integration.webhookSecret}`);

    event = stripe.webhooks.constructEvent(
      req.body, 
      sig,
      integration.webhookSecret
    );
  } catch (err: any) {
    console.error(
      "[stripe/webhook] signature verification failed:",
      err.message
    );
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          workspaceId,
          event.id
        );
        break;

      case "invoice.paid":
        // await handleInvoicePaid(
        //   event.data.object as Stripe.Invoice,
        //   workspaceId,
        //   event.id
        // );
        console.log(
          "Received invoice.paid event, but handler not implemented yet."
        );
        break;

      case "charge.succeeded":
        await handleChargeSucceeded(
          event.data.object as Stripe.Charge,
          workspaceId,
          event.id
        );
        console.log(
          "Received charge.succeeded event, but handler not implemented yet."
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        // await handleSubscriptionChange(
        //   event.data.object as Stripe.Subscription,
        //   workspaceId,
        //   event.id,
        //   event.type
        // );
        console.log(
          `Received ${event.type} event, but handler not implemented yet.`
        );
        break;

      default:
        console.log("Unhandled event:", event.type);
        break;
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] processing error for ${event.type}:`, err);

    // ⚠️ Return 200 to avoid duplicate retries
    return res.status(200).json({ error: "Processing failed" });
  }

  return res.json({ received: true });
};
