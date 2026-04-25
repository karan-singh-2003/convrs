// ------------------------------------------------------------------
// checkout.session.completed
// One-time payments and new subscriptions

import { Stripe } from "stripe";
import { randomUUID } from "crypto";
import { recordEvent } from "@repo/analytics";
// ------------------------------------------------------------------
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  workspaceId: string,
  stripeEventId: string
) {
  const amount    = session.amount_total ?? 0;
  const currency  = session.currency ?? "inr";
  const visitorId = session.metadata?.datafast_visitor_id;
  const sessionId = session.metadata?.datafast_session_id || "";

  if (!visitorId) {
    console.warn("[stripe/webhook] No visitor_id in metadata — skipping");
    return;
  }

  await recordEvent({
    req: new Request("http://internal/stripe-webhook"),
    payload: {
      website_id:  workspaceId,
      visitor_id:  visitorId,
      session_id:  sessionId,          // null is fine now
      type:        "payment",
      url:         "",
      event_name:  "checkout_completed",
      revenue: {
        amount:   amount / 100,
        currency: currency.toUpperCase(),
        provider: "stripe",
      },
      props: {
        stripe_event_id:   stripeEventId,
        stripe_session_id: session.id,
        payment_intent_id: session.payment_intent,
        customer_email:    session.customer_details?.email ?? null,
      },
    },
    logger: console as any,
  });
}
