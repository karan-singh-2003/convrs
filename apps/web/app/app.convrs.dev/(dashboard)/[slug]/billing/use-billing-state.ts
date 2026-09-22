"use client";

/**
 * Headless billing state/behavior for the `[slug]/billing` route — the single
 * source of truth for subscription data and every billing action (checkout,
 * attach-to-growth, start-trial, change-plan, manage-billing, cancel/resume).
 * The route's own page.tsx owns all the JSX/visual design; these hooks own
 * fetching, local UI state, and the network calls, so there is nowhere else
 * in the app that duplicates this logic.
 *
 * All network calls hit the Deploy-2 endpoints (`/api/subscriptions*`,
 * `/api/workspaces/[slug]/billing/{attach,manage,start-free-trial}`), never
 * the deprecated `/api/workspaces/[slug]/billing/upgrade` shim.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  PRICING_FAMILIES,
  type PricingFamily,
  type TierKey,
} from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import useBillingContext from "@/lib/swr/use-billing-context";
import { isDowngradeSelection } from "@/lib/billing/plan-compare";
import { getRemainingTrialDays } from "@/lib/billing/trial-utils";
import type { WorkspaceSubscriptionSummary } from "@/lib/types";

export type BillingInterval = "monthly" | "yearly";

// Default tier/interval the plan-picker cards start on before the shopper
// touches the events dropdown or the Monthly/Yearly toggle.
export const ENTRY_TIER: TierKey = "t10k";
export const ENTRY_INTERVAL: BillingInterval = "monthly";
export const TRIAL_DAYS = 14;

export function planPrice(
  family: PricingFamily,
  tier: TierKey,
  interval: BillingInterval,
): number | null {
  const plan = PRICING_FAMILIES[family].find((p) => p.tier === tier);
  return interval === "yearly" ? (plan?.price.yearly ?? null) : (plan?.price.monthly ?? null);
}

export function planFeatures(family: PricingFamily, tier: TierKey) {
  return PRICING_FAMILIES[family].find((p) => p.tier === tier)?.features ?? [];
}

export function planEvents(family: PricingFamily, tier: TierKey): number {
  return PRICING_FAMILIES[family].find((p) => p.tier === tier)?.limits.events ?? 0;
}

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) || "Something went wrong");
  return json;
}

/**
 * Top-level fetch: workspace + subscription + the user's cross-workspace
 * billing context, and the covered/uncovered decision that picks which
 * sub-hook (below) the page should use.
 */
export function useBillingState() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const {
    slug,
    id: workspaceId,
    subscription,
    subscriptionStatus,
    loading: wsLoading,
    error: wsError,
  } = useWorkspace();
  const { billingContext, loading: ctxLoading, mutate: mutateCtx } = useBillingContext();

  const loading = wsLoading || ctxLoading;

  // A "trialing" subscription with no Dodo subscription yet (I-10, a cardless
  // trial that's never touched Dodo — see WorkspaceSubscriptionSummary.
  // hasPaymentMethod) isn't "covered" in the sense that matters here: it
  // can't go through change-plan (which requires a real dodoSubscriptionId),
  // it needs the checkout/conversion flow instead. A trialing subscription
  // that DOES have hasPaymentMethod (already converted, still inside Dodo's
  // deferred-billing window — Dodo reports it as "active", but ours can
  // still legitimately read "trialing" here right after the webhook, or for
  // the rarer card-optional-at-$0-price case) stays covered as before.
  const covered =
    !!subscription &&
    ["active", "trialing", "past_due", "canceling"].includes(subscription.status) &&
    (subscription.status !== "trialing" || subscription.hasPaymentMethod);

  // Remaining days on an unconverted cardless trial — used by the (now
  // reachable) uncovered plan-picker to show "$0 today, then $X in N days"
  // with the visitor's ACTUAL remaining days rather than always assuming a
  // fresh 14, and passed to Dodo Checkout as trial_period_days by
  // createSubscriptionCheckout's existing trial-reuse logic (unchanged).
  const pendingTrialDays =
    subscription && subscription.status === "trialing" && !subscription.hasPaymentMethod
      ? getRemainingTrialDays(
          subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
        )
      : null;

  return {
    slug: (slug as string | null) ?? null,
    workspaceId: (workspaceId as string | null) ?? null,
    loading,
    error: wsError,
    isNew,
    covered,
    subscription: subscription ?? null,
    subscriptionStatus: subscriptionStatus ?? subscription?.status ?? null,
    growthFreeSeat: billingContext?.growthSubWithFreeSeat ?? null,
    trialAvailable: billingContext?.trialAvailable ?? false,
    pendingTrialDays,
    onChanged: () => mutateCtx(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Uncovered workspace — plan picker (checkout / attach-to-growth / trial)     */
/* ─────────────────────────────────────────────────────────────────────────── */

export function useUncoveredBilling({
  slug,
  workspaceId,
  onChanged,
}: {
  slug: string | null;
  workspaceId: string | null;
  onChanged: () => void;
}) {
  const [tier, setTier] = useState<TierKey>(ENTRY_TIER);
  const [interval, setInterval] = useState<BillingInterval>(ENTRY_INTERVAL);
  const [busy, setBusy] = useState<string | null>(null);

  async function checkout(intent: PricingFamily) {
    if (!workspaceId || busy) return;
    setBusy(`checkout-${intent}`);
    try {
      const json = await post("/api/subscriptions", {
        intent,
        tier,
        interval,
        targetWorkspaceId: workspaceId,
      });
      if (json.checkoutUrl) {
        window.location.assign(json.checkoutUrl as string);
        return;
      }
      toast.success("Subscription updated.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function attachToGrowth(growthSubscriptionId: string) {
    if (!slug || busy) return;
    setBusy("attach");
    try {
      await post(`/api/workspaces/${slug}/billing/attach`, {
        subscriptionId: growthSubscriptionId,
      });
      toast.success("This website is now covered by your Growth plan.");
      onChanged();
      window.location.assign(`/${slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach");
    } finally {
      setBusy(null);
    }
  }

  async function startTrial() {
    if (!slug || busy) return;
    setBusy("trial");
    try {
      const json = await post(`/api/workspaces/${slug}/billing/start-free-trial`, {
        family: "standard",
        tier,
      });
      toast.success(
        json.trialEndsAt
          ? `Your ${TRIAL_DAYS}-day free trial is active until ${new Date(json.trialEndsAt as string).toLocaleDateString()}.`
          : "Your free trial has started.",
      );
      onChanged();
      window.location.assign(`/${slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start trial");
    } finally {
      setBusy(null);
    }
  }

  return { tier, setTier, interval, setInterval, busy, checkout, attachToGrowth, startTrial };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Covered workspace — current plan, change plan, manage billing, cancel/resume */
/* ─────────────────────────────────────────────────────────────────────────── */

export function useCoveredBilling({
  slug,
  subscription,
  onChanged,
}: {
  slug: string | null;
  subscription: WorkspaceSubscriptionSummary;
  onChanged: () => void;
}) {
  const family = (subscription.planFamily as PricingFamily) ?? "standard";
  const currentTier = subscription.planTier as TierKey;
  const currentInterval: BillingInterval =
    subscription.billingInterval === "year" ? "yearly" : "monthly";

  const [targetFamily, setTargetFamily] = useState<PricingFamily>(family);
  const [targetTier, setTargetTier] = useState<TierKey>(currentTier);
  const [targetInterval, setTargetInterval] = useState<BillingInterval>(currentInterval);
  const [busy, setBusy] = useState<string | null>(null);

  const dirty =
    targetFamily !== family || targetTier !== currentTier || targetInterval !== currentInterval;

  const isDowngrade = useMemo(
    () =>
      isDowngradeSelection(
        { family, tier: currentTier },
        { family: targetFamily, tier: targetTier },
      ),
    [targetFamily, targetTier, family, currentTier],
  );

  async function applyChange() {
    if (busy) return;
    setBusy("change");
    try {
      const json = await post(`/api/subscriptions/${subscription.id}/change-plan`, {
        targetFamily,
        targetTier,
        targetInterval,
      });
      toast.success(
        json.scheduled
          ? `Change scheduled for ${new Date(json.effectiveAt as string).toLocaleDateString()}.`
          : "Plan updated.",
      );
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not change plan";
      if (msg.toLowerCase().includes("choose which website")) {
        toast.error(
          "Switching Growth → Standard with multiple websites is done from the account Subscriptions page.",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function manageBilling() {
    if (!slug || busy) return;
    setBusy("manage");
    try {
      const json = await post(`/api/workspaces/${slug}/billing/manage`, {});
      if (json.url) window.location.assign(json.url as string);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setBusy(null);
    }
  }

  async function cancelOrResume(resume: boolean) {
    if (busy) return;
    setBusy(resume ? "resume" : "cancel");
    try {
      if (resume) {
        await post(`/api/subscriptions/${subscription.id}/resume`, {});
        toast.success("Subscription resumed.");
      } else {
        await post(`/api/subscriptions/${subscription.id}/cancel`, { mode: "at_period_end" });
        toast.success("Subscription will end at the current period's close.");
      }
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      if (msg.toLowerCase().includes("all")) {
        toast.error(
          "This Growth plan covers multiple websites — cancel it from the account Subscriptions page.",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return {
    family,
    currentTier,
    currentInterval,
    targetFamily,
    setTargetFamily,
    targetTier,
    setTargetTier,
    targetInterval,
    setTargetInterval,
    dirty,
    isDowngrade,
    busy,
    applyChange,
    manageBilling,
    cancelOrResume,
  };
}
