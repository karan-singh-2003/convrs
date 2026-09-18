"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FAMILY_LIMITS,
  TIER_KEYS,
  TIER_LABEL,
  formatEventLimit,
  type PricingFamily,
  type TierKey,
} from "@repo/utils";
import {
  AnimatedSizeContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
} from "@repo/ui";
import type { WorkspaceSubscriptionSummary } from "@/lib/types";
import {
  useBillingState,
  useUncoveredBilling,
  useCoveredBilling,
  planPrice,
  planFeatures,
  planEvents,
  TRIAL_DAYS,
  type BillingInterval,
} from "./use-billing-state";

// The billing page lived at /{slug}/settings/billing before; this route keeps
// that page's original visual design (back link, "Billing" header, compact
// pill controls, two rounded plan cards with an orange pill CTA) as the one
// and only billing UI. What changed is what's *behind* it: the cards'
// pricing/features and CTA now come from the real subscription logic in
// use-billing-state.ts (checkout, attach-to-growth, start-trial, change-plan,
// manage-billing, cancel/resume) instead of hardcoded copy and the
// deprecated `/billing/upgrade` shim, and a current-plan panel appears once a
// workspace is actually covered by a subscription — styled with the same
// compact card/typography/button language as the plan cards, not a
// different design.

// A shared, compact pill toggle used for every Monthly/Yearly control on this
// page — deliberately plain (no dropdown merged into it, no extra wrapping
// container) so it always reads as a single small pill.
const TOGGLE_CLASS = "text-sm";
const TOGGLE_OPTION_CLASS =
  "px-3 py-1 text-sm data-[selected=true]:text-bg-default";
const TOGGLE_INDICATOR_CLASS = "bg-content-default";

export default function BillingPage() {
  return <LegacyBillingPage />;
}

function LegacyBillingPage() {
  const router = useRouter();
  const {
    slug,
    workspaceId,
    loading,
    error,
    isNew,
    covered,
    subscription,
    subscriptionStatus,
    growthFreeSeat,
    trialAvailable,
    onChanged,
  } = useBillingState();

  const uncovered = useUncoveredBilling({ slug, workspaceId, onChanged });

  return (
    <div className="px-2 max-w-3xl mx-auto">
      <h1
        onClick={() => router.push(slug ? `/${slug}` : "/")}
        className="flex items-center gap-2 font-poppins text-sm text-content-default cursor-pointer"
      >
        <ArrowLeft size={15} />
        Back
      </h1>

      <h1 className="font-poppins text-xl text-content-default mt-4">
        Billing
      </h1>

      <AnimatedSizeContainer height className="overflow-visible">
        {error ? (
          <p className="mt-10 text-center font-poppins text-sm text-content-subtle">
            Failed to load billing details. Please refresh and try again.
          </p>
        ) : loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-content-subtle" />
          </div>
        ) : covered && subscription ? (
          <CurrentPlanPanel
            slug={slug!}
            subscription={subscription}
            subscriptionStatus={subscriptionStatus ?? subscription.status}
            onChanged={onChanged}
          />
        ) : (
          <>
            {growthFreeSeat && (
              <AttachToGrowthCard
                growthFreeSeat={growthFreeSeat}
                busy={uncovered.busy === "attach"}
                disabled={uncovered.busy !== null}
                onAttach={() => uncovered.attachToGrowth(growthFreeSeat.id)}
              />
            )}

            {isNew && (
              <p className="mt-4 max-w-2xl mx-auto text-center font-poppins text-sm text-content-subtle sm:text-left">
                Your new website needs a subscription to start tracking.
              </p>
            )}

            <div className="max-w-2xl mx-auto mt-4">
              <PlanControlsRow
                tier={uncovered.tier}
                setTier={uncovered.setTier}
                interval={uncovered.interval}
                setInterval={uncovered.setInterval}
              />

              <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-4">
                <PlanCard
                  title="Standard"
                  family="standard"
                  tier={uncovered.tier}
                  interval={uncovered.interval}
                  trialAvailable={trialAvailable}
                  cta={{
                    label: "Pick Standard Plan",
                    onClick: () => uncovered.checkout("standard"),
                    busy: uncovered.busy === "checkout-standard",
                    disabled: uncovered.busy !== null,
                  }}
                />
                <PlanCard
                  title="Growth"
                  family="growth"
                  tier={uncovered.tier}
                  interval={uncovered.interval}
                  trialAvailable={trialAvailable}
                  cta={{
                    label: "Pick Growth Plan",
                    onClick: () => uncovered.checkout("growth"),
                    busy: uncovered.busy === "checkout-growth",
                    disabled: uncovered.busy !== null,
                  }}
                />
              </div>
            </div>

            {trialAvailable && (
              <button
                onClick={uncovered.startTrial}
                disabled={uncovered.busy !== null}
                className="mt-3 flex w-full items-center justify-center gap-2 font-poppins text-[12px] text-content-subtle underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uncovered.busy === "trial" && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Start a {TRIAL_DAYS}-day free trial on Standard instead (no card)
              </button>
            )}
          </>
        )}
      </AnimatedSizeContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shared controls row — events select (left) + Monthly/Yearly toggle (right)  */
/* ─────────────────────────────────────────────────────────────────────────── */

function PlanControlsRow({
  tier,
  setTier,
  interval,
  setInterval,
}: {
  tier: TierKey;
  setTier: (t: TierKey) => void;
  interval: BillingInterval;
  setInterval: (i: BillingInterval) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-poppins text-[13px] text-content-subtle">
          More events
        </span>
        <Select value={tier} onValueChange={(v) => setTier(v as TierKey)}>
          <SelectTrigger className="h-auto w-auto gap-1.5 rounded-full border border-border-default bg-transparent px-3 py-1 font-poppins text-[13px] text-content-default focus:outline-none focus:ring-1 focus:ring-inset focus:ring-content-default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_KEYS.map((t) => (
              <SelectItem key={t} value={t} className="font-poppins text-[13px]">
                {TIER_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        options={[
          { label: "Monthly", value: "monthly" },
          { label: "Yearly", value: "yearly" },
        ]}
        selected={interval}
        selectAction={(v) => setInterval(v as BillingInterval)}
        className={TOGGLE_CLASS}
        optionClassName={TOGGLE_OPTION_CLASS}
        indicatorClassName={TOGGLE_INDICATOR_CLASS}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shared plan card — used by the uncovered picker and by Change Plan below    */
/* ─────────────────────────────────────────────────────────────────────────── */

function PlanCard({
  title,
  family,
  tier,
  interval,
  trialAvailable,
  cta,
  highlighted,
}: {
  title: string;
  family: PricingFamily;
  tier: TierKey;
  interval: BillingInterval;
  trialAvailable: boolean;
  cta: { label: string; onClick: () => void; busy: boolean; disabled: boolean };
  highlighted?: boolean;
}) {
  const amount = planPrice(family, tier, interval);
  const unit = interval === "yearly" ? "year" : "month";
  const features = planFeatures(family, tier);

  return (
    <div
      className={`bg-bg-card rounded-[2rem] w-full sm:max-w-[360px] min-h-[520px] p-5 flex flex-col ${
        highlighted ? "ring-1 ring-content-default" : ""
      }`}
    >
      <h1 className="font-poppins text-[12px] text-content-subtle uppercase">
        {title}
      </h1>

      <h2 className="font-alexandria text-2xl mt-1.5">
        {trialAvailable ? (
          <>
            $0{" "}
            <span className="text-[12px] text-content-subtle">
              then ${amount}/{unit} in {TRIAL_DAYS} days
            </span>
          </>
        ) : (
          <>
            ${amount}
            <span className="text-[12px] text-content-subtle">/{unit}</span>
          </>
        )}
      </h2>

      <div className="mt-5 space-y-2">
        <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
          <Check size={14} />
          {formatEventLimit(planEvents(family, tier))}
        </p>

        <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
          <Check size={14} />
          {FAMILY_LIMITS[family]} website{FAMILY_LIMITS[family] > 1 ? "s" : ""}
        </p>

        {features.map((f) => (
          <p
            key={f.id}
            className="flex items-center gap-2 font-poppins text-sm text-content-default"
          >
            <Check size={14} />
            {f.name}
          </p>
        ))}
      </div>

      <button
        onClick={cta.onClick}
        disabled={cta.disabled}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-bg-inverted py-2.5 text-sm font-poppins font-semibold text-content-inverted transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cta.busy && <Loader2 size={14} className="animate-spin" />}
        {cta.label}
      </button>

      {trialAvailable && (
        <p className="text-[11px] mt-1 text-center font-display text-content-subtle">
          No charge until free trial ends in {TRIAL_DAYS} days
        </p>
      )}
    </div>
  );
}

function AttachToGrowthCard({
  growthFreeSeat,
  busy,
  disabled,
  onAttach,
}: {
  growthFreeSeat: { id: string; workspaceCount: number; maxWorkspaces: number };
  busy: boolean;
  disabled: boolean;
  onAttach: () => void;
}) {
  return (
    <div className="bg-bg-card rounded-[2rem] w-full max-w-2xl mx-auto mt-4 p-5">
      <h2 className="font-poppins text-sm text-content-default">
        Add this website to your Growth plan
      </h2>
      <p className="mt-1 font-poppins text-[13px] text-content-subtle">
        You have {growthFreeSeat.maxWorkspaces - growthFreeSeat.workspaceCount} of{" "}
        {growthFreeSeat.maxWorkspaces} websites free on your Growth subscription. Adding this one
        is free and takes effect immediately.
      </p>
      <button
        onClick={onAttach}
        disabled={disabled}
        className="mt-3 flex items-center justify-center gap-2 rounded-full bg-bg-inverted px-5 py-2 font-poppins text-sm font-semibold text-content-inverted transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Add this website to Growth
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Covered workspace — current plan panel + two-card Change Plan section       */
/* ─────────────────────────────────────────────────────────────────────────── */

function CurrentPlanPanel({
  slug,
  subscription,
  subscriptionStatus,
  onChanged,
}: {
  slug: string;
  subscription: WorkspaceSubscriptionSummary;
  subscriptionStatus: string;
  onChanged: () => void;
}) {
  const {
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
  } = useCoveredBilling({ slug, subscription, onChanged });

  // Each card's own CTA carries out the change — there is no separate
  // "Apply" button. A card that isn't targeted yet just selects itself
  // (setTargetFamily); once it's the target, its own button becomes the one
  // that commits (applyChange) whatever tier/interval/family is currently
  // dialed in above.
  function ctaFor(cardFamily: PricingFamily) {
    const isTargeted = targetFamily === cardFamily;
    if (isTargeted && !dirty) {
      return { label: "Current plan", onClick: () => {}, busy: false, disabled: true };
    }
    if (isTargeted) {
      return {
        label: isDowngrade ? "Schedule downgrade" : "Apply change",
        onClick: applyChange,
        busy: busy === "change",
        disabled: busy !== null,
      };
    }
    return {
      label: `Switch to ${cardFamily === "growth" ? "Growth" : "Standard"}`,
      onClick: () => setTargetFamily(cardFamily),
      busy: false,
      disabled: busy !== null,
    };
  }

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <div className="bg-bg-card rounded-2xl w-full p-4">
        <h1 className="font-poppins text-base font-semibold text-content-default">
          {family === "growth" ? "Growth" : "Standard"}
        </h1>

        <p className="font-poppins text-sm text-content-subtle">
          {TIER_LABEL[currentTier]} events
        </p>

        <p className="font-poppins text-sm text-content-subtle">
          {subscriptionStatus === "trialing"
            ? "Free trial"
            : subscriptionStatus === "canceling"
              ? "Ends at period close"
              : subscriptionStatus === "past_due"
                ? "Payment overdue"
                : "Active"}
        </p>

        <div className="mt-2 space-y-1 font-poppins text-sm text-content-default">
          <p>Billed {currentInterval === "yearly" ? "yearly" : "monthly"}</p>
          <p>
            {subscription.workspaceCount} / {subscription.maxWorkspaces} website
            {subscription.maxWorkspaces > 1 ? "s" : ""}
          </p>
          {subscription.currentPeriodEnd && (
            <p>
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
          {subscription.trialEndsAt && subscriptionStatus === "trialing" && (
            <p>Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</p>
          )}
        </div>

        {subscription.hasPaymentMethod && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={manageBilling}
              disabled={busy !== null}
              className="font-poppins text-sm text-content-default underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "manage" ? "Opening…" : "Manage billing & invoices"}
            </button>
            {subscription.cancelAtPeriodEnd ? (
              <button
                onClick={() => cancelOrResume(true)}
                disabled={busy !== null}
                className="font-poppins text-sm text-content-default underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "resume" ? "Resuming…" : "Resume subscription"}
              </button>
            ) : (
              <button
                onClick={() => cancelOrResume(false)}
                disabled={busy !== null}
                className="font-poppins text-sm text-red-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
              </button>
            )}
          </div>
        )}
      </div>

      <h3 className="font-poppins text-[12px] text-content-subtle uppercase mt-6">
        Change plan
      </h3>

      <div className="mt-2">
        <PlanControlsRow
          tier={targetTier}
          setTier={setTargetTier}
          interval={targetInterval}
          setInterval={setTargetInterval}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-4">
        <PlanCard
          title="Standard"
          family="standard"
          tier={targetTier}
          interval={targetInterval}
          trialAvailable={false}
          highlighted={targetFamily === "standard"}
          cta={ctaFor("standard")}
        />
        <PlanCard
          title="Growth"
          family="growth"
          tier={targetTier}
          interval={targetInterval}
          trialAvailable={false}
          highlighted={targetFamily === "growth"}
          cta={ctaFor("growth")}
        />
      </div>

      {isDowngrade && dirty && (
        <p className="my-3 font-poppins text-[12px] text-content-subtle text-center">
          Downgrades take effect at the end of the current billing period. No website data is
          deleted.
        </p>
      )}
    </div>
  );
}
