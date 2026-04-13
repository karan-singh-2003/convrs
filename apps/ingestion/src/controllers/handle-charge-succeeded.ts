// ------------------------------------------------------------------
// charge.succeeded
// Raw charge events — useful for one-time payments not via checkout

import { Stripe } from "stripe";
import { prisma } from "@repo/db";
import { randomUUID } from "crypto";
// ------------------------------------------------------------------
export async function handleChargeSucceeded(
  charge: Stripe.Charge,
  workspaceId: string,
  stripeEventId: string
) {
//   const exists = await prisma.processedStripeEvent.findUnique({
//     where: { stripeEventId },
//   });
//   if (exists) return;

  // Skip if this charge belongs to an invoice (already captured in invoice.paid)
//   if (charge.invoice) return;

  const customerId = typeof charge.customer === "string"
    ? charge.customer
    : charge.customer?.id ?? null;

  const payload = {
    event_id:   randomUUID(),
    timestamp:  new Date(charge.created * 1000)
      .toISOString().replace("T", " ").replace("Z", ""),
    event_type: "sale",
    event_name: "charge_succeeded",
    workspace_id: workspaceId,

    utm_source:   charge.metadata?.utm_source   ?? null,
    utm_medium:   charge.metadata?.utm_medium   ?? null,
    utm_campaign: charge.metadata?.utm_campaign ?? null,
    utm_content:  charge.metadata?.utm_content  ?? null,
    utm_term:     charge.metadata?.utm_term     ?? null,
    visitor_id:   charge.metadata?.visitor_id   ?? null,
    session_id:   null,

    country:   charge.billing_details?.address?.country ?? "",
    city:      charge.billing_details?.address?.city    ?? "",
    region:    charge.billing_details?.address?.state   ?? "",
    continent: "",

    event_properties: JSON.stringify({
      stripe_event_id:    stripeEventId,
      stripe_charge_id:   charge.id,
      stripe_customer_id: customerId,
      payment_intent_id:  typeof charge.payment_intent === "string"
                            ? charge.payment_intent
                            : charge.payment_intent?.id ?? null,
      amount:             charge.amount,
      amount_captured:    charge.amount_captured,
      currency:           charge.currency,
      description:        charge.description ?? null,
      payment_method:     charge.payment_method_details?.type ?? null,
      customer_email:     charge.billing_details?.email ?? null,
      customer_name:      charge.billing_details?.name  ?? null,
      receipt_url:        charge.receipt_url ?? null,
    }),
  };

  console.log("[stripe/webhook] recording event:", payload);

//   await ingestSaleEvent(payload);
//   await db.processedStripeEvent.create({ data: { stripeEventId } });
}