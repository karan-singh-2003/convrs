import type { CustomerRow } from "@/lib/api/customers/query-customers";

/**
 * Public /api/v1/customers* response shape — deliberately redacted.
 *
 * CustomerRow (lib/api/customers/query-customers.ts) is shared with the
 * dashboard's own session-authenticated /api/workspaces/[idOrSlug]/customers
 * routes, which need `email`/`stripeCustomerId` for the Customers UI — so
 * those fields are NOT removed from CustomerRow itself, only projected out
 * here, at the public API boundary, gated by `analytics.read` (a broader,
 * more commonly-granted scope than `payments.read`). This keeps the same
 * "never expose a payment-provider identifier or raw PII under a scope
 * that isn't meant to reveal it" rule already applied to /api/v1/payments.
 */
export type PublicCustomer = Omit<CustomerRow, "email" | "stripeCustomerId">;

export function toPublicCustomer(customer: CustomerRow): PublicCustomer {
  const { email, stripeCustomerId, ...rest } = customer;
  return rest;
}
