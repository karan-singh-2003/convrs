// ------------------------------------------------------------------
// checkout.session.completed
// One-time payments and new subscriptions

import { Stripe } from "stripe";
import { prisma } from "@repo/db";
import { randomUUID } from "crypto";
// ------------------------------------------------------------------
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  workspaceId: string,
  stripeEventId: string
) {
  // Idempotency — skip if already processed
  //   const exists = await prisma.processedStripeEvent.findUnique({
  //     where: { stripeEventId },
  //   });
  //   if (exists) return;

  const amount = session.amount_total ?? 0;
  const currency = session.currency ?? "usd";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const payload = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
    event_type: "sale",
    event_name: "checkout_completed",
    workspace_id: workspaceId,

    // Pull attribution from session metadata if you passed it at checkout creation
    utm_source: session.metadata?.utm_source ?? null,
    utm_medium: session.metadata?.utm_medium ?? null,
    utm_campaign: session.metadata?.utm_campaign ?? null,
    utm_content: session.metadata?.utm_content ?? null,
    utm_term: session.metadata?.utm_term ?? null,
    visitor_id: session.metadata?.visitor_id ?? null,
    session_id: session.metadata?.session_id ?? null,

    // Geo — from session if available
    country: session.customer_details?.address?.country ?? "",
    city: "",
    region: "",
    continent: "",

    event_properties: JSON.stringify({
      stripe_event_id: stripeEventId,
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      payment_status: session.payment_status,
      payment_intent_id: session.payment_intent ?? null,
      subscription_id: session.subscription ?? null,
      amount_total: amount,
      amount_subtotal: session.amount_subtotal ?? amount,
      currency,
      mode: session.mode, // "payment" | "subscription" | "setup"
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      line_items_count: session.line_items?.data.length ?? null,
    }),
  };
  
  console.log("[stripe/webhook] recording event:", payload);
  //   await ingestSaleEvent(payload);

  // Mark as processed
  //   await db.processedStripeEvent.create({ data: { stripeEventId } });
}
