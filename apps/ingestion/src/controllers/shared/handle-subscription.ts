// apps/ingestion/src/controllers/shared/handle-subscription.ts
import { processSubscriptionEvent } from "@repo/analytics";
import type { ProcessSubscriptionOptions } from "@repo/analytics";

/**
 * Thin shared wrapper around processSubscriptionEvent, mirroring
 * handlePaymentEvent. Each provider controller normalizes its own webhook
 * payload into ProcessSubscriptionOptions and calls this.
 *
 * Errors are logged and swallowed — a subscription webhook failing must not
 * cause the provider to retry-storm, and the next lifecycle event will
 * re-sync the row anyway (the upsert is idempotent on provider+externalId).
 */
export async function handleSubscriptionEvent(params: ProcessSubscriptionOptions) {
  if (!params.visitorId) {
    console.warn(
      `[${params.provider}/webhook] subscription ${params.externalId} has no convrs_visitor_id — storing without attribution`
    );
  }

  try {
    await processSubscriptionEvent(params);
  } catch (err) {
    console.error(
      `[${params.provider}/webhook] subscription processing error for ${params.externalId}:`,
      err
    );
  }
}
