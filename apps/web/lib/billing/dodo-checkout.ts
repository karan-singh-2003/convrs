/**
 * lib/billing/dodo-checkout.ts
 *
 * The only place that talks to Dodo's checkout/customer-portal APIs for
 * Convrs's own subscription billing. `subscription-service.ts` calls these;
 * route handlers never touch the Dodo SDK directly.
 */

import { dodo } from "@/lib/dodo";
import { APP_DOMAIN } from "@repo/utils";
import type { DodoCheckoutMetadata } from "@/lib/dodo/types";

export interface CheckoutArgs {
  productId: string;
  /** attach an existing Dodo customer, else create one from email/name */
  customer: { customerId: string } | { email?: string | null; name?: string | null };
  metadata: DodoCheckoutMetadata;
  /** inject a Dodo-side trial (cardless-trial conversion). 0/undefined = no trial. */
  trialPeriodDays?: number | null;
  returnUrl: string;
}

/** Create a Dodo Checkout Session. Returns the hosted checkout URL. */
export async function createCheckoutSession(args: CheckoutArgs): Promise<{ url: string; sessionId: string }> {
  const customer =
    "customerId" in args.customer
      ? { customer_id: args.customer.customerId }
      : { email: args.customer.email ?? "", name: args.customer.name ?? undefined };

  // Dodo metadata values must be strings.
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(args.metadata)) {
    if (v != null && v !== "") metadata[k] = String(v);
  }

  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: args.productId, quantity: 1 }],
    customer: customer as never,
    metadata,
    ...(args.trialPeriodDays && args.trialPeriodDays > 0
      ? { subscription_data: { trial_period_days: args.trialPeriodDays } }
      : {}),
    return_url: args.returnUrl,
  });

  const url = session.checkout_url;
  if (!url) throw new Error("Dodo checkout session created without a checkout_url");
  return { url, sessionId: session.session_id };
}

/** Hosted customer-portal session for a Dodo customer (billing history, payment methods, cancel). */
export async function createCustomerPortalSession(
  dodoCustomerId: string,
  returnUrl?: string,
): Promise<{ link: string }> {
  const session = await dodo.customers.customerPortal.create(dodoCustomerId, {
    ...(returnUrl ? { return_url: returnUrl } : {}),
  });
  return { link: session.link };
}

export function appUrl(path: string): string {
  return `${APP_DOMAIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Map a Dodo API error to a user-facing message. Ported from the old billing/upgrade route. */
export function mapDodoError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; statusCode?: number; error?: { message?: string }; message?: string };
  const status = e?.status ?? e?.statusCode ?? 500;
  const raw = e?.error?.message ?? e?.message ?? "";
  if (status === 409)
    return {
      status: 400,
      message:
        "Your previous payment hasn't completed yet. Please wait a few minutes and try again, or update your payment method.",
    };
  if (status === 422) return { status: 400, message: `Invalid request: ${raw}` };
  if (status === 429) return { status: 429, message: "Too many requests. Please wait a moment and try again." };
  if (status === 404) return { status: 404, message: "Subscription not found. Please contact support." };
  return { status: 400, message: raw || "Failed to update plan. Please try again." };
}
