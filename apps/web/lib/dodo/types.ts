/**
 * lib/dodo/types.ts
 *
 * Types for the Dodo Payments webhook payloads and checkout metadata that
 * Convrs's own subscription billing uses. Shapes follow the `dodopayments`
 * SDK's `Subscription` / webhook-event types and
 * https://docs.dodopayments.com/developer-resources/webhooks
 */

// ─── Dodo subscription status (NOT our Prisma SubscriptionStatus enum) ────────
export type DodoSubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "cancelled"
  | "failed"
  | "expired";

// ─── Checkout metadata we set, then read back on the webhook ──────────────────
export interface DodoCheckoutMetadata {
  /** our internal Subscription.id, created before the checkout session */
  internalSubscriptionId?: string;
  ownerUserId?: string;
  /** workspace to attach on activation ("" when none) */
  targetWorkspaceId?: string;
  intent?: "standard" | "growth";
  [key: string]: string | undefined;
}

export interface DodoCustomer {
  customer_id: string;
  email: string;
  name: string;
}

// ─── Subscription payload (webhook `data` for subscription.* events) ──────────
export interface DodoSubscriptionPayload {
  subscription_id: string;
  customer: DodoCustomer;
  product_id: string;
  status: DodoSubscriptionStatus;

  /** ISO-8601 — end of the current billing period */
  next_billing_date: string;
  /** ISO-8601 — start of the current billing period */
  previous_billing_date?: string | null;
  created_at?: string;

  payment_frequency_interval?: "Day" | "Week" | "Month" | "Year";
  payment_frequency_count?: number;
  subscription_period_interval?: "Day" | "Week" | "Month" | "Year";
  subscription_period_count?: number;

  /** true → scheduled for cancellation at next billing date */
  cancel_at_next_billing_date: boolean;
  cancelled_at?: string | null;

  currency: string;
  recurring_pre_tax_amount?: number;
  trial_period_days?: number;

  /** present when a plan change is scheduled but not yet effective */
  scheduled_change?: {
    id: string;
    effective_at: string;
    product_id: string;
    quantity: number;
  } | null;

  metadata: DodoCheckoutMetadata;
}

// ─── Webhook envelope ────────────────────────────────────────────────────────
export type DodoSubscriptionEventType =
  | "subscription.active"
  | "subscription.updated"
  | "subscription.renewed"
  | "subscription.plan_changed"
  | "subscription.on_hold"
  | "subscription.cancelled"
  | "subscription.expired"
  | "subscription.failed";

export interface DodoWebhookEnvelope {
  business_id: string;
  type: string;
  timestamp: string; // ISO-8601
  data: DodoSubscriptionPayload | Record<string, unknown>;
}

export function isSubscriptionEvent(
  event: DodoWebhookEnvelope,
): event is DodoWebhookEnvelope & { type: DodoSubscriptionEventType; data: DodoSubscriptionPayload } {
  return typeof event.type === "string" && event.type.startsWith("subscription.");
}

/** Structure stored in Subscription.pendingPlanChange (Json). */
export interface PendingPlanChange {
  kind: "tier_down" | "downgrade_to_standard" | "consolidate";
  effectiveAt: string; // ISO-8601
  targetFamily: "standard" | "growth";
  targetTier: string;
  targetInterval: "monthly" | "yearly";
  keepWorkspaceId?: string;
  /** internal Subscription ids to absorb + cancel (consolidate) */
  consolidateStandardSubIds?: string[];
  /** workspace ids to re-point onto the growth sub (consolidate) */
  moveWorkspaceIds?: string[];
}
