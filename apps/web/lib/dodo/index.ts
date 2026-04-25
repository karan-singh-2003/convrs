/**
 * lib/dodo.ts
 *
 * Drop-in replacement for lib/stripe.ts.
 * Initialises the official Dodo Payments Node SDK once and exports a
 * singleton so every route share the same instance (and the same
 * webhookKey for signature verification).
 *
 * Install:  npm install dodopayments
 *
 * .env vars required:
 *   DODO_PAYMENTS_API_KEY          – secret key from Dashboard → Developers
 *   DODO_PAYMENTS_WEBHOOK_KEY      – signing secret from Dashboard → Webhooks
 *   DODO_PAYMENTS_ENVIRONMENT      – "test_mode" | "live_mode"  (default: test_mode)
 */

import DodoPayments from "dodopayments";

if (!process.env.DODO_PAYMENTS_API_KEY) {
  throw new Error("Missing env var: DODO_PAYMENTS_API_KEY");
}

export const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  // Dodo uses "test_mode" / "live_mode" instead of Stripe's boolean flag.
  environment:
    (process.env.DODO_PAYMENTS_ENVIRONMENT as
      | "test_mode"
      | "live_mode"
      | undefined) ?? "test_mode",
  // webhookKey is used by client.webhooks.unwrap() in the webhook handler.
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
});