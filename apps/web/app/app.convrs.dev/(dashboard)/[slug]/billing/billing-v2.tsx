"use client";

/**
 * Deploy 3b — the rebuilt workspace billing page, behind NEXT_PUBLIC_BILLING_V2.
 *
 * Two states (docs/billing-implementation-plan.md §9.2):
 *   - uncovered workspace → the Scenario-6 decision tree: add to an existing
 *     Growth plan that has a free seat / buy a Standard subscription / switch to
 *     (or start) Growth / start the one-time 14-day trial.
 *   - covered workspace → current-plan panel with tier + interval change,
 *     Standard↔Growth, manage-billing portal, and cancel / resume.
 *
 * All network calls go to the Deploy-2 endpoints (`/api/subscriptions*`,
 * `/api/workspaces/[slug]/billing/{attach,manage,start-free-trial}`), never the
 * deprecated `upgrade` shim.
 */

import { Loader2, ArrowLeft, Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ToggleGroup } from "@repo/ui";
import {
  PRICING_FAMILIES,
  TIER_KEYS,
  TIER_LABEL,
  FAMILY_LIMITS,
  formatEventLimit,
  type PricingFamily,
  type TierKey,
} from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import useBillingContext from "@/lib/swr/use-billing-context";
import { isDowngradeSelection } from "@/lib/billing/plan-compare";

type Interval = "monthly" | "yearly";

function price(family: PricingFamily, tier: TierKey, interval: Interval): number | null {
  const plan = PRICING_FAMILIES[family].find((p) => p.tier === tier);
  return interval === "yearly" ? plan?.price.yearly ?? null : plan?.price.monthly ?? null;
}

export function BillingPageV2() {
  const router = useRouter();
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
  const covered =
    !!subscription &&
    ["active", "trialing", "past_due", "canceling"].includes(subscription.status);

  return (
    <div className="mx-auto max-w-3xl px-2">
      <button
        onClick={() => router.push(slug ? `/${slug}` : "/")}
        className="flex items-center gap-2 font-poppins text-sm text-content-default"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <h1 className="mt-5 font-poppins text-xl text-content-default">Billing</h1>

      {wsError ? (
        <p className="mt-16 text-center font-poppins text-sm text-content-subtle">
          Failed to load billing details. Please refresh and try again.
        </p>
      ) : loading ? (
        <div className="mt-20 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-content-subtle" />
        </div>
      ) : covered && subscription ? (
        <CurrentPlanPanel
          slug={slug!}
          subscription={subscription}
          subscriptionStatus={subscriptionStatus ?? subscription.status}
          onChanged={() => mutateCtx()}
        />
      ) : (
        <UncoveredChoices
          slug={slug!}
          workspaceId={workspaceId!}
          isNew={isNew}
          growthFreeSeat={billingContext?.growthSubWithFreeSeat ?? null}
          trialAvailable={billingContext?.trialAvailable ?? false}
          onChanged={() => mutateCtx()}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Uncovered workspace — the decision tree                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function UncoveredChoices({
  slug,
  workspaceId,
  isNew,
  growthFreeSeat,
  trialAvailable,
  onChanged,
}: {
  slug: string;
  workspaceId: string;
  isNew: boolean;
  growthFreeSeat: { id: string; workspaceCount: number; maxWorkspaces: number } | null;
  trialAvailable: boolean;
  onChanged: () => void;
}) {
  const [tier, setTier] = useState<TierKey>("t10k");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState<string | null>(null);

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

  async function checkout(intent: PricingFamily) {
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

  async function attachToGrowth() {
    if (!growthFreeSeat) return;
    setBusy("attach");
    try {
      await post(`/api/workspaces/${slug}/billing/attach`, { subscriptionId: growthFreeSeat.id });
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
    setBusy("trial");
    try {
      const json = await post(`/api/workspaces/${slug}/billing/start-free-trial`, {
        family: "standard",
        tier,
      });
      toast.success(
        json.trialEndsAt
          ? `Your 14-day free trial is active until ${new Date(json.trialEndsAt as string).toLocaleDateString()}.`
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

  return (
    <div className="mt-8 space-y-6">
      <p className="font-poppins text-sm text-content-subtle">
        {isNew
          ? "Your new website needs a subscription to start tracking."
          : "This website isn't covered by a subscription yet."}
      </p>

      {growthFreeSeat && (
        <div className="rounded-2xl bg-bg-emphasis p-5">
          <h2 className="font-poppins text-[15px] text-content-default">
            Add to your Growth plan
          </h2>
          <p className="mt-1 font-poppins text-[13px] text-content-subtle">
            You have {growthFreeSeat.maxWorkspaces - growthFreeSeat.workspaceCount} of{" "}
            {growthFreeSeat.maxWorkspaces} websites free on your Growth subscription. Adding this
            one is free and takes effect immediately — no new payment.
          </p>
          <button
            onClick={attachToGrowth}
            disabled={busy !== null}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-content-default px-5 py-2.5 font-poppins text-sm text-bg-default disabled:opacity-60"
          >
            {busy === "attach" && <Loader2 size={14} className="animate-spin" />}
            Add this website to Growth
          </button>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center justify-end gap-2">
          <div className="relative inline-flex">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as TierKey)}
              className="appearance-none rounded-full border border-border-subtle bg-bg-card py-1.5 pl-3.5 pr-8 font-poppins text-[13px] font-medium text-content-default focus:outline-none focus:ring-1 focus:ring-content-default"
            >
              {TIER_KEYS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
            />
          </div>

          <ToggleGroup
            className="bg-bg-emphasis"
            optionClassName="px-3.5 py-1.5 text-[13px] font-poppins font-medium"
            options={[
              { label: "Monthly", value: "monthly" },
              { label: "Yearly", value: "yearly" },
            ]}
            selected={interval}
            selectAction={(v) => setInterval(v as Interval)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard
            title="Starter"
            family="standard"
            tier={tier}
            interval={interval}
            trialAvailable={trialAvailable}
            busy={busy === "checkout-standard"}
            disabled={busy !== null}
            onPick={() => checkout("standard")}
            cta="Pick Starter Plan"
          />
          <PlanCard
            title="Growth"
            family="growth"
            tier={tier}
            interval={interval}
            trialAvailable={trialAvailable}
            busy={busy === "checkout-growth"}
            disabled={busy !== null}
            onPick={() => checkout("growth")}
            cta="Pick Growth Plan"
          />
        </div>

        {trialAvailable && (
          <button
            onClick={startTrial}
            disabled={busy !== null}
            className="mt-4 flex w-full items-center justify-center gap-2 font-poppins text-[13px] text-content-subtle underline disabled:opacity-60"
          >
            {busy === "trial" && <Loader2 size={13} className="animate-spin" />}
            Start a 14-day free trial on Starter instead (no card)
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Plan card — Standard ("Starter") / Growth, price for the shared tier+interval */
/* ─────────────────────────────────────────────────────────────────────────── */

function PlanCard({
  title,
  family,
  tier,
  interval,
  trialAvailable,
  busy,
  disabled,
  onPick,
  cta,
}: {
  title: string;
  family: PricingFamily;
  tier: TierKey;
  interval: Interval;
  trialAvailable: boolean;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  cta: string;
}) {
  const plan = PRICING_FAMILIES[family].find((p) => p.tier === tier);
  const amount = price(family, tier, interval);
  const unit = interval === "yearly" ? "year" : "month";

  return (
    <div className="flex flex-col rounded-3xl bg-bg-subtle p-6">
      <span className="font-poppins text-xs font-medium uppercase tracking-wide text-content-subtle">
        {title}
      </span>

      <div className="mt-3 flex items-baseline gap-1.5">
        {trialAvailable ? (
          <>
            <span className="font-poppins text-3xl font-semibold text-content-default">$0</span>
            <span className="font-poppins text-[13px] text-content-subtle">
              then ${amount}/{unit} in 14 days
            </span>
          </>
        ) : (
          <span className="font-poppins text-3xl font-semibold text-content-default">
            ${amount}
            <span className="text-[13px] font-normal text-content-subtle">/{unit}</span>
          </span>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-2">
        <li className="flex items-center gap-2 font-poppins text-[13px] text-content-default">
          <Check size={14} className="shrink-0 text-content-subtle" />
          {formatEventLimit(plan?.limits.events ?? 0)}
        </li>
        <li className="flex items-center gap-2 font-poppins text-[13px] text-content-default">
          <Check size={14} className="shrink-0 text-content-subtle" />
          {FAMILY_LIMITS[family]} website{FAMILY_LIMITS[family] > 1 ? "s" : ""}
        </li>
        {(plan?.features ?? []).map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 font-poppins text-[13px] text-content-default"
          >
            <Check size={14} className="shrink-0 text-content-subtle" />
            {f.name}
          </li>
        ))}
      </ul>

      <button
        onClick={onPick}
        disabled={disabled}
        className="mt-6 flex items-center justify-center gap-2 rounded-full bg-content-default px-5 py-3 font-poppins text-sm font-medium text-bg-default disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {cta}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Covered workspace — current-plan panel                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function CurrentPlanPanel({
  slug,
  subscription,
  subscriptionStatus,
  onChanged,
}: {
  slug: string;
  subscription: NonNullable<ReturnType<typeof useWorkspace>["subscription"]>;
  subscriptionStatus: string;
  onChanged: () => void;
}) {
  const family = (subscription.planFamily as PricingFamily) ?? "standard";
  const currentTier = subscription.planTier as TierKey;
  const currentInterval: Interval =
    subscription.billingInterval === "year" ? "yearly" : "monthly";

  const [targetFamily, setTargetFamily] = useState<PricingFamily>(family);
  const [targetTier, setTargetTier] = useState<TierKey>(currentTier);
  const [targetInterval, setTargetInterval] = useState<Interval>(currentInterval);
  const [busy, setBusy] = useState<string | null>(null);

  const dirty =
    targetFamily !== family ||
    targetTier !== currentTier ||
    targetInterval !== currentInterval;

  const isDowngrade = useMemo(
    () =>
      isDowngradeSelection(
        { family, tier: currentTier },
        { family: targetFamily, tier: targetTier },
      ),
    [targetFamily, targetTier, family, currentTier],
  );

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

  async function applyChange() {
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
        toast.error("Switching Growth → Standard with multiple websites is done from the account Subscriptions page.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function manageBilling() {
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
        toast.error("This Growth plan covers multiple websites — cancel it from the account Subscriptions page.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl bg-bg-emphasis p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-poppins text-[15px] text-content-default">
            {family === "growth" ? "Growth" : "Standard"} · {TIER_LABEL[currentTier]} events
          </h2>
          <span className="font-poppins text-[13px] text-content-subtle">
            {subscriptionStatus === "trialing"
              ? "Free trial"
              : subscriptionStatus === "canceling"
                ? "Ends at period close"
                : subscriptionStatus === "past_due"
                  ? "Payment overdue"
                  : "Active"}
          </span>
        </div>
        <dl className="mt-3 space-y-1 font-poppins text-[13px] text-content-subtle">
          <div className="flex justify-between">
            <dt>Billing</dt>
            <dd>{currentInterval === "yearly" ? "Yearly" : "Monthly"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Websites</dt>
            <dd>
              {subscription.workspaceCount} / {subscription.maxWorkspaces}
            </dd>
          </div>
          {subscription.currentPeriodEnd && (
            <div className="flex justify-between">
              <dt>{subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}</dt>
              <dd>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</dd>
            </div>
          )}
          {subscription.trialEndsAt && subscriptionStatus === "trialing" && (
            <div className="flex justify-between">
              <dt>Trial ends</dt>
              <dd>{new Date(subscription.trialEndsAt).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-2xl bg-bg-emphasis p-5">
        <h3 className="font-poppins text-[14px] text-content-default">Change plan</h3>
        <div className="mt-4">
          <PlanPicker
            family={targetFamily}
            setFamily={setTargetFamily}
            tier={targetTier}
            setTier={setTargetTier}
            interval={targetInterval}
            setInterval={setTargetInterval}
          />
        </div>
        <button
          onClick={applyChange}
          disabled={!dirty || busy !== null}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-content-default px-5 py-2.5 font-poppins text-sm text-bg-default disabled:opacity-50"
        >
          {busy === "change" && <Loader2 size={14} className="animate-spin" />}
          {isDowngrade ? "Schedule downgrade" : "Apply change"}
        </button>
        {isDowngrade && dirty && (
          <p className="mt-2 font-poppins text-[12px] text-content-subtle">
            Downgrades take effect at the end of the current billing period. No website data is
            deleted.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={manageBilling}
          disabled={busy !== null}
          className="rounded-full border border-border-default px-5 py-2.5 font-poppins text-sm text-content-default disabled:opacity-60"
        >
          {busy === "manage" ? "Opening…" : "Manage billing & invoices"}
        </button>
        {subscription.cancelAtPeriodEnd ? (
          <button
            onClick={() => cancelOrResume(true)}
            disabled={busy !== null}
            className="rounded-full border border-border-default px-5 py-2.5 font-poppins text-sm text-content-default disabled:opacity-60"
          >
            {busy === "resume" ? "Resuming…" : "Resume subscription"}
          </button>
        ) : (
          <button
            onClick={() => cancelOrResume(false)}
            disabled={busy !== null}
            className="rounded-full px-5 py-2.5 font-poppins text-sm text-content-error disabled:opacity-60"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shared tier / interval / family picker                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function PlanPicker({
  family,
  setFamily,
  tier,
  setTier,
  interval,
  setInterval,
}: {
  family: PricingFamily;
  setFamily: (f: PricingFamily) => void;
  tier: TierKey;
  setTier: (t: TierKey) => void;
  interval: Interval;
  setInterval: (i: Interval) => void;
}) {
  const amount = price(family, tier, interval);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["standard", "growth"] as PricingFamily[]).map((f) => (
          <button
            key={f}
            onClick={() => setFamily(f)}
            className={`flex-1 rounded-full px-3 py-2 font-poppins text-[13px] ${
              family === f
                ? "bg-content-default text-bg-default"
                : "border border-border-default text-content-subtle"
            }`}
          >
            {f === "growth" ? "Growth" : "Standard"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["monthly", "yearly"] as Interval[]).map((i) => (
          <button
            key={i}
            onClick={() => setInterval(i)}
            className={`rounded-full px-3 py-1.5 font-poppins text-[12px] ${
              interval === i
                ? "bg-content-default text-bg-default"
                : "border border-border-default text-content-subtle"
            }`}
          >
            {i === "yearly" ? "Yearly" : "Monthly"}
          </button>
        ))}
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={TIER_KEYS.length - 1}
          step={1}
          value={TIER_KEYS.indexOf(tier)}
          onChange={(e) => setTier(TIER_KEYS[Number(e.target.value)])}
          className="w-full accent-content-default"
        />
        <div className="mt-2 flex items-center justify-between font-poppins text-[13px] text-content-default">
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            {formatEventLimit(
              PRICING_FAMILIES[family].find((p) => p.tier === tier)?.limits.events ?? 0,
            )}
          </span>
          <span>
            {amount === null
              ? "—"
              : `$${amount}/${interval === "yearly" ? "yr" : "mo"}`}
          </span>
        </div>
      </div>
    </div>
  );
}
