// packages/analytics/src/subscription.ts
//
// Turns a normalized subscription lifecycle event (from any revenue provider's
// webhook) into a CustomerSubscription row. That table is the source of truth
// for MRR — see lib/analytics/get-mrr-timeseries.ts in apps/web.

import { prisma } from "@repo/db";
import { AttributionStatus } from "@repo/db/client";
import type { RevenueProvider } from "@repo/db/client";
import { attemptAttribution } from "./attribution";
import type {
  CustomerSubscriptionStatus,
  SubscriptionInterval,
} from "./mrr";

export type SubscriptionLifecycle = "created" | "updated" | "canceled";

export interface ProcessSubscriptionOptions {
  workspaceId: string;
  provider: RevenueProvider;
  event: SubscriptionLifecycle;

  externalId: string; // provider-side subscription id (idempotency key)
  externalCustomerId?: string | null;

  status: CustomerSubscriptionStatus;

  amount: number; // per-period price, smallest currency unit
  currency: string;
  interval: SubscriptionInterval;
  intervalCount?: number;
  plan?: string | null;

  startedAt?: Date | null;
  canceledAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;

  customerEmail?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
}

/**
 * Upsert a CustomerSubscription from a provider webhook. Idempotent on
 * (provider, externalId). Runs attribution once (while still pending) so the
 * subscription's MRR can be filtered to attributed revenue if needed later.
 */
export async function processSubscriptionEvent(
  opts: ProcessSubscriptionOptions
): Promise<void> {
  const {
    workspaceId,
    provider,
    event,
    externalId,
    externalCustomerId,
    status,
    amount,
    currency,
    interval,
    intervalCount = 1,
    plan,
    startedAt,
    canceledAt,
    currentPeriodStart,
    currentPeriodEnd,
    customerEmail,
    visitorId,
    sessionId,
  } = opts;

  if (!externalId) {
    console.warn(`[${provider}/webhook] subscription event with no externalId — skipping`);
    return;
  }

  const existing = await prisma.customerSubscription.findUnique({
    where: { provider_externalId: { provider, externalId } },
  });

  // ── Resolve / create the Customer ─────────────────────────────────────────
  let customerId = existing?.customerId ?? null;
  if (!customerId) {
    let customer =
      visitorId
        ? await prisma.customer.findFirst({
            where: { workspaceId, externalId: visitorId },
          })
        : null;

    if (!customer && customerEmail) {
      customer = await prisma.customer.findFirst({
        where: { workspaceId, email: customerEmail },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          workspaceId,
          externalId: visitorId ?? null,
          email: customerEmail ?? null,
          attributionStatus: AttributionStatus.pending,
        },
      });
    }

    customerId = customer.id;
  }

  // ── Attribution (only while still pending) ────────────────────────────────
  const now = new Date();
  let attributionStatus: AttributionStatus =
    existing?.attributionStatus ?? AttributionStatus.pending;
  let attributedAt: Date | null = existing?.attributedAt ?? null;
  let attributedVisitorId: string | null =
    existing?.visitorId ?? visitorId ?? null;

  if (attributionStatus === AttributionStatus.pending) {
    const attribution = await attemptAttribution({
      workspaceId,
      visitorId: visitorId ?? existing?.visitorId ?? undefined,
      sessionId: sessionId ?? existing?.sessionId ?? undefined,
    });

    attributionStatus = attribution.attributed
      ? AttributionStatus.attributed
      : attribution.retryable
        ? AttributionStatus.pending
        : AttributionStatus.unattributed;
    attributedAt = attribution.attributed ? now : null;
    attributedVisitorId = attribution.visitorId || attributedVisitorId;
  }

  const resolvedCanceledAt =
    canceledAt ??
    (status === "canceled" ? (existing?.canceledAt ?? now) : null);

  const data = {
    workspaceId,
    customerId: customerId!,
    provider,
    externalId,
    externalCustomerId: externalCustomerId ?? existing?.externalCustomerId ?? null,
    status,
    amount: Math.max(0, Math.round(amount || 0)),
    currency: currency.toUpperCase(),
    interval,
    intervalCount: intervalCount > 0 ? intervalCount : 1,
    plan: plan ?? existing?.plan ?? null,
    startedAt: startedAt ?? existing?.startedAt ?? now,
    canceledAt: resolvedCanceledAt,
    currentPeriodStart: currentPeriodStart ?? existing?.currentPeriodStart ?? null,
    currentPeriodEnd: currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
    attributionStatus,
    attributedAt,
    lastAttributionAttempt: now,
    visitorId: attributedVisitorId,
    sessionId: sessionId ?? existing?.sessionId ?? null,
  };

  await prisma.customerSubscription.upsert({
    where: { provider_externalId: { provider, externalId } },
    create: data,
    update: data,
  });

  // Touch the customer's cancel timestamp so the Customers UI reflects churn.
  if (event === "canceled" && customerId) {
    await prisma.customer
      .update({
        where: { id: customerId },
        data: { subscriptionCanceledAt: resolvedCanceledAt ?? now },
      })
      .catch(() => {});
  }
}
