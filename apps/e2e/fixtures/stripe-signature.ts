import Stripe from "stripe";

// A bare API-key string is fine here — this Stripe instance is only used for
// its webhooks helper (pure crypto, no network call), never to call the
// Stripe API.
const stripe = new Stripe("sk_test_e2e_placeholder_not_a_real_key", {
  apiVersion: "2026-01-28.clover" as any,
});

/**
 * Signs a webhook payload the same way Stripe itself would, using the
 * SDK's own test helper — this is real HMAC signature verification on the
 * receiving end (apps/ingestion's stripeWebhookController), not a stub.
 */
export function signStripePayload(
  payload: string,
  secret: string
): { signatureHeader: string; payload: string } {
  const signatureHeader = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return { signatureHeader, payload };
}

export function buildCheckoutSessionCompletedPayload(params: {
  sessionId: string;
  eventId: string;
  amountTotal: number;
  currency: string;
  customerEmail: string;
  visitorId?: string | null;
  sessionIdMeta?: string | null;
  paymentIntentId?: string | null;
}): string {
  const event = {
    id: params.eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: params.sessionId,
        object: "checkout.session",
        amount_total: params.amountTotal,
        currency: params.currency,
        payment_intent: params.paymentIntentId ?? null,
        customer_details: { email: params.customerEmail },
        metadata: {
          ...(params.visitorId && { convrs_visitor_id: params.visitorId }),
          ...(params.sessionIdMeta && {
            convrs_session_id: params.sessionIdMeta,
          }),
        },
      },
    },
  };
  return JSON.stringify(event);
}
