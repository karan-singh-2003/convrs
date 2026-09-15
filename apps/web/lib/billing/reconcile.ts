/**
 * lib/billing/reconcile.ts
 *
 * Deploy 4 — the hourly self-heal for Convrs's own subscription billing
 * (docs/billing-implementation-plan.md §10). Dodo is authoritative; this pass
 * re-derives our `Subscription` rows (and their fanned-out `Workspace` cache)
 * from `dodo.subscriptions.retrieve()` and fixes any drift caused by a missed,
 * late, or failed webhook.
 *
 * Repair is done by **replaying** the webhook processor with a synthetic event
 * built from the live Dodo state — so all the idempotent, absolute-valued logic
 * in webhook-processor.ts (status map, plan adoption, pending-change
 * application, seat recount, fan-out) is reused, not duplicated.
 */

import { prisma } from "@repo/db";
import { dodo } from "@/lib/dodo";
import {
  processWebhookEvent,
  mapStatus,
} from "@/lib/billing/webhook-processor";
import { fanOutSubscription, recomputeWorkspaceCount } from "@/lib/billing/fan-out";
import type {
  DodoSubscriptionPayload,
  DodoSubscriptionStatus,
  DodoSubscriptionEventType,
  PendingPlanChange,
} from "@/lib/dodo/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FAILED_EVENT_RETRY_AFTER_MS = HOUR_MS;
const WEBHOOK_EVENT_TTL_MS = 90 * DAY_MS;

/** Minimal shape of the SDK `Subscription` retrieve() response we consume. */
export interface DodoSubscriptionLike {
  subscription_id: string;
  product_id: string;
  status: string;
  currency?: string | null;
  next_billing_date?: string | null;
  previous_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean | null;
  created_at?: string | null;
  trial_period_days?: number | null;
  customer?: { customer_id?: string; email?: string; name?: string } | null;
  metadata?: Record<string, string> | null;
}

/** Map a live Dodo subscription onto the webhook payload shape the processor expects. */
export function dodoSubscriptionToPayload(s: DodoSubscriptionLike): DodoSubscriptionPayload {
  return {
    subscription_id: s.subscription_id,
    customer: {
      customer_id: s.customer?.customer_id ?? "",
      email: s.customer?.email ?? "",
      name: s.customer?.name ?? "",
    },
    product_id: s.product_id,
    status: s.status as DodoSubscriptionStatus,
    next_billing_date: s.next_billing_date ?? new Date().toISOString(),
    previous_billing_date: s.previous_billing_date ?? null,
    created_at: s.created_at ?? undefined,
    cancel_at_next_billing_date: Boolean(s.cancel_at_next_billing_date),
    currency: (s.currency ?? "USD").toUpperCase(),
    trial_period_days: s.trial_period_days ?? undefined,
    metadata: (s.metadata ?? {}) as DodoSubscriptionPayload["metadata"],
  };
}

/** What our row currently believes — the fields reconcile compares. */
export interface LocalSubscriptionState {
  status: string;
  dodoProductId: string | null;
  currentPeriodEnd: Date | null;
  pendingPlanChange: PendingPlanChange | null;
}

export interface ReconcileDecision {
  event: DodoSubscriptionEventType;
  reason: string;
}

/**
 * Decide whether (and how) to replay the processor for one subscription.
 * Returns null when our row already matches Dodo and nothing is due.
 * Pure — unit-tested in reconcile.test.ts.
 */
export function decideReconcile(
  local: LocalSubscriptionState,
  remote: DodoSubscriptionPayload,
  now: Date = new Date(),
): ReconcileDecision | null {
  const dodoStatus = mapStatus(remote.status, remote.cancel_at_next_billing_date);
  const dodoEnd = remote.next_billing_date ? new Date(remote.next_billing_date) : null;

  // A scheduled change whose time has come but Dodo never confirmed.
  const pending = local.pendingPlanChange;
  if (
    pending &&
    pending.kind !== "consolidate" &&
    new Date(pending.effectiveAt).getTime() <= now.getTime()
  ) {
    return { event: "subscription.plan_changed", reason: "pending plan change is due" };
  }

  // Our row says "ending" and the period has closed, but Dodo hasn't told us.
  if (
    local.status === "canceling" &&
    local.currentPeriodEnd != null &&
    local.currentPeriodEnd.getTime() < now.getTime() &&
    !["canceled", "expired"].includes(dodoStatus)
  ) {
    return { event: "subscription.expired", reason: "canceling subscription past period end" };
  }

  if (dodoStatus !== local.status) {
    const terminal = dodoStatus === "canceled" || dodoStatus === "expired";
    return {
      event: terminal ? "subscription.cancelled" : "subscription.updated",
      reason: `status drift (ours=${local.status}, dodo=${dodoStatus})`,
    };
  }

  if (remote.product_id !== local.dodoProductId) {
    return { event: "subscription.plan_changed", reason: "product_id drift" };
  }

  // Period advanced → replay as a renewal so usage resets.
  if (
    dodoEnd != null &&
    local.currentPeriodEnd != null &&
    dodoEnd.getTime() > local.currentPeriodEnd.getTime()
  ) {
    return { event: "subscription.renewed", reason: "billing period advanced" };
  }

  if (
    dodoEnd != null &&
    (local.currentPeriodEnd == null ||
      dodoEnd.getTime() !== local.currentPeriodEnd.getTime())
  ) {
    return { event: "subscription.updated", reason: "period end drift" };
  }

  return null;
}

export interface ReconcileReport {
  scannedSubscriptions: number;
  repaired: { id: string; event: string; reason: string }[];
  trialsLapsed: string[];
  seatCountFixed: string[];
  dodoMissing: string[];
  failedEventsRetried: number;
  webhookEventsPruned: number;
  errors: { id: string; error: string }[];
}

function isNotFound(err: unknown): boolean {
  return (err as { status?: number })?.status === 404;
}

/** Run one full reconciliation pass. Safe to call repeatedly. */
export async function reconcileBilling(now: Date = new Date()): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    scannedSubscriptions: 0,
    repaired: [],
    trialsLapsed: [],
    seatCountFixed: [],
    dodoMissing: [],
    failedEventsRetried: 0,
    webhookEventsPruned: 0,
    errors: [],
  };

  // 1. Cardless trials that have lapsed (no Dodo subscription to retrieve).
  const lapsedTrials = await prisma.subscription.findMany({
    where: {
      dodoSubscriptionId: null,
      status: "trialing",
      trialEndsAt: { lt: now },
    },
    select: { id: true },
  });
  for (const t of lapsedTrials) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({ where: { id: t.id }, data: { status: "inactive" } });
        await fanOutSubscription(t.id, tx);
      });
      report.trialsLapsed.push(t.id);
    } catch (err) {
      report.errors.push({ id: t.id, error: String(err).slice(0, 300) });
    }
  }

  // 2. Every subscription bound to Dodo and not already terminal.
  const subs = await prisma.subscription.findMany({
    where: {
      dodoSubscriptionId: { not: null },
      status: { notIn: ["canceled", "expired"] },
    },
    select: {
      id: true,
      dodoSubscriptionId: true,
      status: true,
      dodoProductId: true,
      currentPeriodEnd: true,
      workspaceCount: true,
      pendingPlanChange: true,
    },
  });
  report.scannedSubscriptions = subs.length;

  for (const sub of subs) {
    try {
      let live: DodoSubscriptionLike;
      try {
        live = (await dodo.subscriptions.retrieve(sub.dodoSubscriptionId!)) as unknown as DodoSubscriptionLike;
      } catch (err) {
        if (isNotFound(err)) {
          // Dodo forgot this subscription → treat as expired.
          await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
              where: { id: sub.id },
              data: { status: "expired", cancelAtPeriodEnd: true, workspaceCount: 0 },
            });
            await fanOutSubscription(sub.id, tx);
          });
          report.dodoMissing.push(sub.id);
          continue;
        }
        throw err;
      }

      const payload = dodoSubscriptionToPayload(live);
      const decision = decideReconcile(
        {
          status: sub.status,
          dodoProductId: sub.dodoProductId,
          currentPeriodEnd: sub.currentPeriodEnd,
          pendingPlanChange: (sub.pendingPlanChange as PendingPlanChange | null) ?? null,
        },
        payload,
        now,
      );

      if (decision) {
        const webhookId = `reconcile:${sub.id}:${now.getTime()}`;
        await prisma.dodoWebhookEvent.createMany({
          data: [
            {
              webhookId,
              eventType: decision.event,
              dodoSubscriptionId: sub.dodoSubscriptionId,
              status: "processing",
            },
          ],
          skipDuplicates: true,
        });
        await processWebhookEvent(
          { type: decision.event, timestamp: now.toISOString(), data: payload },
          webhookId,
        );
        report.repaired.push({ id: sub.id, event: decision.event, reason: decision.reason });
        continue;
      }

      // No drift, but the seat count may still be stale (attach/detach races).
      const actual = await prisma.workspace.count({ where: { subscriptionId: sub.id } });
      if (actual !== sub.workspaceCount) {
        await prisma.$transaction(async (tx) => {
          await recomputeWorkspaceCount(sub.id, tx);
          await fanOutSubscription(sub.id, tx);
        });
        report.seatCountFixed.push(sub.id);
      }
    } catch (err) {
      report.errors.push({ id: sub.id, error: String(err).slice(0, 300) });
    }
  }

  // 3. Failed webhook rows older than an hour → replay from live Dodo state.
  const failed = await prisma.dodoWebhookEvent.findMany({
    where: {
      status: "failed",
      dodoSubscriptionId: { not: null },
      receivedAt: { lt: new Date(now.getTime() - FAILED_EVENT_RETRY_AFTER_MS) },
    },
    select: { webhookId: true, eventType: true, dodoSubscriptionId: true },
    take: 200,
  });
  for (const evt of failed) {
    try {
      const live = (await dodo.subscriptions.retrieve(evt.dodoSubscriptionId!)) as unknown as DodoSubscriptionLike;
      await processWebhookEvent(
        {
          type: evt.eventType,
          timestamp: now.toISOString(),
          data: dodoSubscriptionToPayload(live),
        },
        evt.webhookId,
      );
      report.failedEventsRetried += 1;
    } catch (err) {
      await prisma.dodoWebhookEvent
        .update({
          where: { webhookId: evt.webhookId },
          data: { attempts: { increment: 1 }, error: String(err).slice(0, 900) },
        })
        .catch(() => {});
      report.errors.push({ id: evt.webhookId, error: String(err).slice(0, 300) });
    }
  }

  // 4. Prune processed webhook rows older than 90 days.
  const pruned = await prisma.dodoWebhookEvent.deleteMany({
    where: {
      status: { in: ["done", "failed"] },
      receivedAt: { lt: new Date(now.getTime() - WEBHOOK_EVENT_TTL_MS) },
    },
  });
  report.webhookEventsPruned = pruned.count;

  return report;
}
