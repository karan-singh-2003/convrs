// packages/analytics/src/services/payment.service.ts
import { prisma } from "@repo/db";
import { attemptAttribution } from "./attribution";
import { recordEvent } from "./record-event";
import { AttributionStatus } from "@repo/db/client";

export interface ProcessPaymentOptions {
  workspaceId: string;
  userId: string;
  websiteId: string;         // projectToken — needed for recordEvent
  stripeSessionId: string;
  stripeEventId: string;
  stripePaymentIntent?: string | null;
  amount: number;            // in cents
  currency: string;
  customerEmail?: string | null;
  visitorId?: string;
  sessionId?: string;
}

export async function processPayment(opts: ProcessPaymentOptions): Promise<void> {
  const {
    workspaceId,
    userId,
    websiteId,
    stripeSessionId,
    stripeEventId,
    stripePaymentIntent,
    amount,
    currency,
    customerEmail,
    visitorId,
    sessionId,
  } = opts;

  // ── 1. Idempotency guard ────────────────────────────────────────────────────
  // Use upsert so concurrent retries don't race — second call is a no-op
  const existingPayment = await prisma.payment.findUnique({
    where: { stripeEventId },
  });
  if (existingPayment) {
    console.log(`[payment] Already processed stripeEventId=${stripeEventId} — skipping`);
    return;
  }

  // ── 2. Find or create Customer (race-safe) ──────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: {
      workspaceId_externalId: {
        workspaceId,
        externalId: visitorId ?? "",
      },
    },
    create: {
      workspaceId,
      externalId: visitorId ?? null,
      email: customerEmail ?? null,
      attributionStatus: AttributionStatus.pending,
    },
    update: {
      // fill in email if we now have it and didn't before
      ...(customerEmail ? { email: customerEmail } : {}),
    },
  });

  // ── 3. Persist Payment (race-safe) ─────────────────────────────────────────
  const payment = await prisma.payment.upsert({
    where: { stripeEventId },
    create: {
      workspaceId,
      customerId: customer.id,
      stripeSessionId,
      stripeEventId,
      stripePaymentIntent: stripePaymentIntent ?? null,
      amount,
      currency: currency.toUpperCase(),
      customerEmail: customerEmail ?? null,
      visitorId: visitorId ?? null,
      sessionId: sessionId ?? null,
      attributionStatus: AttributionStatus.pending,
    },
    update: {}, // no-op on duplicate — idempotent
  });
  // ── 4. Attempt attribution ──────────────────────────────────────────────────
  const attribution = await attemptAttribution({
    workspaceId,
    visitorId,
    sessionId,
  });

  const now = new Date();
  const newAttributionStatus = attribution.attributed
    ? AttributionStatus.attributed
    : AttributionStatus.unattributed;

  // ── 5. Update Payment with attribution result ──────────────────────────────
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      attributionStatus: newAttributionStatus,
      attributedAt: attribution.attributed ? now : null,
      lastAttributionAttempt: now,
    },
  });

  // ── 6. Update Customer attribution status ─────────────────────────────────
  // A customer is considered attributed once ANY payment is attributed.
  // We don't downgrade an already-attributed customer.
  const shouldUpgradeCustomer =
    attribution.attributed &&
    customer.attributionStatus !== AttributionStatus.attributed;

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      attributionStatus: shouldUpgradeCustomer
        ? AttributionStatus.attributed
        : customer.attributionStatus === AttributionStatus.attributed
          ? AttributionStatus.attributed
          : newAttributionStatus,
      attributedAt: shouldUpgradeCustomer ? now : customer.attributedAt,
      lastAttributionAttempt: now,
      visitorId: attribution.visitorId || customer.visitorId,
      // Update aggregate sales counters
      sales: { increment: 1 },
      saleAmount: { increment: BigInt(amount) },
      firstSaleAt: customer.firstSaleAt ?? now,
    },
  });

  // ── 7. Send to Tinybird ────────────────────────────────────────────────────
  // Revenue = actual amount only if attributed. Zero otherwise.
  // This keeps unattributed payments out of analytics revenue totals
  // while preserving them in the database.
  const tinybirdRevenue = attribution.attributed ? amount / 100 : 0;

  const ctx = attribution.enrichedContext;

  // const tinybirdEventId = crypto.randomUUID();

  try {
    const recorded = await recordEvent({
      req: new Request("http://internal/stripe-webhook"),
      payload: {
        workspace_id: workspaceId,
        website_id: websiteId,
        visitor_id: visitorId ?? "unknown",
        session_id: sessionId ?? "",
        user_id: userId,
        type: "payment",
        url: ctx?.url ?? "",
        hostname: ctx ? new URL(ctx.url).hostname : "",
        event_name: "checkout_completed",
        // Pass enriched geo/device from the visitor's browser session
        country: ctx?.country,
        city: ctx?.city,
        region: ctx?.region,
        continent: ctx?.continent,
        revenue: {
          amount: tinybirdRevenue,
          currency: currency.toUpperCase() as any,
          provider: "stripe",
          provider_id: stripeSessionId,
        },
        props: {
          stripe_event_id: stripeEventId,
          stripe_session_id: stripeSessionId,
          payment_intent_id: stripePaymentIntent,
          customer_email: customerEmail ?? null,
          attributed: attribution.attributed,
          attribution_status: newAttributionStatus,
        },
      },
      logger: console as any,
    });

    if (recorded) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          tinybirdEventId: recorded.event_id,
          sentToTinybird: true,
          sentToTinybirdAt: new Date(),
        },
      });
    }
  } catch (err) {
    // Tinybird failure must NEVER cause payment data loss.
    // Payment is already safely stored in Postgres.
    console.error("[payment] Failed to send to Tinybird — payment data is safe in DB", err);
  }
}
