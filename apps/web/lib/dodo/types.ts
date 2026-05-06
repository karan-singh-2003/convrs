/**
 * lib/dodo/webhook-types.ts
 *
 * TypeScript types for every Dodo Payments webhook payload your app handles.
 * Sourced directly from the Dodo docs:
 * https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription
 * https://docs.dodopayments.com/developer-resources/webhooks/intents/payment
 *
 * The top-level envelope is the same for every event.
 * `data` is discriminated by `type`.
 */

// ─── Shared sub-types ─────────────────────────────────────────────────────────

export interface DodoCustomer {
  customer_id: string;
  email: string;
  name: string;
}

export interface DodoBillingAddress {
  country: string;
  city?: string | null;
  state?: string | null;
  street?: string | null;
  zipcode?: string | null;
}

// ─── Subscription payload ─────────────────────────────────────────────────────
// Shape from: /developer-resources/webhooks/intents/subscription

export interface DodoSubscriptionPayload {
  type: string;
  payload_type: "Subscription";
  subscription_id: string;
  customer: DodoCustomer;
  product_id: string;
  status:
    | "active"
    | "on_hold"
    | "cancelled"
    | "expired"
    | "failed"
    | "paused";

  /** ISO-8601 — end of the current billing period (replaces Stripe's current_period_end) */
  next_billing_date: string;
  created_at: string;

  /** "monthly" | "annual" */
  payment_frequency_interval: "Day" | "Week" | "Month" | "Year";
  payment_frequency_count: number;

  /** "monthly" | "annual" — same field, more semantic alias used in our code */
  billing_interval?: "month" | "year";

  /** true  → scheduled for cancellation at next billing date */
  cancel_at_next_billing_date: boolean;

  currency: string;
  metadata: Record<string, string>;
}

// ─── Payment payload ──────────────────────────────────────────────────────────

export interface DodoPaymentPayload {
  payload_type: "Payment";
  payment_id: string;
  subscription_id?: string | null;
  customer: DodoCustomer;
  status: "succeeded" | "failed" | "processing" | "cancelled";
  amount: number;          // in smallest currency unit (cents)
  currency: string;
  metadata: Record<string, string>;
  created_at: string;
}

// ─── Webhook envelope ─────────────────────────────────────────────────────────

export type DodoEventType =
  // Subscription
  | "subscription.active"
  | "subscription.updated"
  | "subscription.on_hold"
  | "subscription.renewed"
  | "subscription.plan_changed"
  | "subscription.cancelled"
  | "subscription.failed"
  | "subscription.expired"
  // Payment
  | "payment.succeeded"
  | "payment.failed"
  | "payment.processing"
  | "payment.cancelled";

export interface DodoWebhookEvent {
  business_id: string;
  type: DodoEventType;
  timestamp: string;          // ISO-8601
  data: DodoSubscriptionPayload | DodoPaymentPayload;
}

// ─── Typed narrowing helpers ──────────────────────────────────────────────────

export function isSubscriptionEvent(
  event: DodoWebhookEvent
): event is DodoWebhookEvent & { data: DodoSubscriptionPayload } {
  return (event.data as DodoSubscriptionPayload).payload_type === "Subscription";
}

export function isPaymentEvent(
  event: DodoWebhookEvent
): event is DodoWebhookEvent & { data: DodoPaymentPayload } {
  return (event.data as DodoPaymentPayload).payload_type === "Payment";
}