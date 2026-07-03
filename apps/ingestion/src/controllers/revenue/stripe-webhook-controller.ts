// import { Request, Response } from "express";
// import Stripe from "stripe";
// import { prisma } from "@repo/db";
// import { decrypt } from "@repo/analytics";
// import { handleCheckoutCompleted } from "./handle-checkout-complete.js";


// export const stripeWebhookController = async (req: Request, res: Response) => {
//   const workspaceIdParam = req.params.workspaceId;
//   const workspaceId = Array.isArray(workspaceIdParam)
//     ? workspaceIdParam[0]
//     : workspaceIdParam;
//   const sigHeader = req.headers["stripe-signature"];
//   const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

//   if (!workspaceId) {
//     return res.status(400).json({ error: "Missing workspaceId" });
//   }

//   if (!sig) {
//     return res.status(400).json({ error: "Missing stripe-signature" });
//   }

//   // Load integration
//   const integration = await prisma.stripeIntegration.findFirst({
//     where: { workspaceId: workspaceId },
//   });

//   if (!integration) {
//     return res.status(404).json({ error: "Integration not found" });
//   }

//   let event: Stripe.Event;

//   try {
//     const stripe = new Stripe(decrypt(integration.apiKeyEncrypted), {
//       apiVersion: "2026-01-28.clover",
//     });

//     console.log(`[stripe/webhook] verifying signature for workspace ${workspaceId} using secret ${integration.webhookSecret}`);

//     event = stripe.webhooks.constructEvent(
//       req.body, 
//       sig,
//       integration.webhookSecret
//     );
//   } catch (err: any) {
//     console.error(
//       "[stripe/webhook] signature verification failed:",
//       err.message
//     );
//     return res.status(400).json({ error: "Invalid signature" });
//   }

//   try {
//     switch (event.type) {
//       case "checkout.session.completed":
//         await handleCheckoutCompleted(
//           event.data.object as Stripe.Checkout.Session,
//           workspaceId,
//           event.id
//         );
//         break;

//       default:
//         console.log("Unhandled event:", event.type);
//         break;
//     }
//   } catch (err: any) {
//     console.error(`[stripe/webhook] processing error for ${event.type}:`, err);

//     //  Return 200 to avoid duplicate retries
//     return res.status(200).json({ error: "Processing failed" });
//   }

//   return res.json({ received: true });
// };


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
  console.log("integration",integration)
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