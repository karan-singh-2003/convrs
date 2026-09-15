"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PRICING_FAMILIES,
  TIER_KEYS,
  TIER_LABEL,
  type PricingFamily,
  type TierKey,
} from "@repo/utils";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import useSubscriptions, {
  type SubscriptionSummary,
} from "@/lib/swr/use-subscriptions";

type Interval = "monthly" | "yearly";

const ACTIVE_STATUSES = ["active", "trialing", "past_due", "canceling"];

export function SubscriptionsPageClient() {
  const { subscriptions, loading, error, mutate } = useSubscriptions();

  return (
    <SettingsChildrenLayout
      title="Subscriptions"
      description="Every subscription you own, and the websites each one covers."
      className="lg:px-8 px-3"
    >
      {error ? (
        <p className="py-16 text-center font-display text-sm text-content-subtle">
          Failed to load subscriptions.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-content-subtle" />
        </div>
      ) : !subscriptions || subscriptions.length === 0 ? (
        <p className="py-16 text-center font-display text-sm text-content-subtle">
          You don&apos;t have any subscriptions yet. Open a website&apos;s Billing page to start one.
        </p>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((s) => (
            <SubscriptionCard key={s.id} sub={s} onChanged={() => mutate()} />
          ))}
        </div>
      )}
    </SettingsChildrenLayout>
  );
}

function SubscriptionCard({
  sub,
  onChanged,
}: {
  sub: SubscriptionSummary;
  onChanged: () => void;
}) {
  const family = (sub.planFamily as PricingFamily) ?? "standard";
  const currentTier = sub.planTier as TierKey;
  const currentInterval: Interval = sub.interval === "yearly" ? "yearly" : "monthly";

  const [targetFamily, setTargetFamily] = useState<PricingFamily>(family);
  const [targetTier, setTargetTier] = useState<TierKey>(currentTier);
  const [targetInterval, setTargetInterval] = useState<Interval>(currentInterval);
  const [busy, setBusy] = useState<string | null>(null);

  const editable = ACTIVE_STATUSES.includes(sub.status) && sub.status !== "canceling";
  const dirty =
    targetFamily !== family ||
    targetTier !== currentTier ||
    targetInterval !== currentInterval;

  const portalSlug = sub.workspaces[0]?.slug ?? null;

  async function post(url: string, body: unknown) {
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
      const json = await post(`/api/subscriptions/${sub.id}/change-plan`, {
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
          "Growth → Standard with multiple websites needs you to pick which one to keep — do this from that website's Billing page.",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function cancelOrResume(resume: boolean) {
    setBusy(resume ? "resume" : "cancel");
    try {
      if (resume) {
        await post(`/api/subscriptions/${sub.id}/resume`, {});
        toast.success("Subscription resumed.");
      } else {
        const ack =
          family === "growth" && sub.workspaces.length > 1
            ? { acknowledgeWorkspaceIds: sub.workspaces.map((w) => w.id) }
            : {};
        await post(`/api/subscriptions/${sub.id}/cancel`, { mode: "at_period_end", ...ack });
        toast.success("Subscription will end at the current period's close.");
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function manageBilling() {
    if (!portalSlug) return;
    setBusy("manage");
    try {
      const json = await post(`/api/workspaces/${portalSlug}/billing/manage`, {});
      if (json.url) window.location.assign(json.url as string);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-medium text-content-default">
          {family === "growth" ? "Growth" : "Standard"} · {TIER_LABEL[currentTier]} events ·{" "}
          {currentInterval === "yearly" ? "Yearly" : "Monthly"}
        </h3>
        <span className="font-display text-[12px] text-content-subtle">
          {sub.status}
          {sub.cancelAtPeriodEnd ? " · ending" : ""}
        </span>
      </div>

      <p className="mt-1 font-display text-[13px] text-content-subtle">
        Websites {sub.workspaceCount} / {sub.maxWorkspaces}
        {sub.currentPeriodEnd
          ? ` · ${sub.cancelAtPeriodEnd ? "ends" : "renews"} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
          : ""}
      </p>

      {sub.workspaces.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {sub.workspaces.map((w) => (
            <li
              key={w.id}
              className="rounded-full bg-bg-emphasis px-2 py-0.5 font-display text-[12px] text-content-default"
            >
              {w.name}
            </li>
          ))}
        </ul>
      )}

      {sub.pendingPlanChange && (
        <p className="mt-2 font-display text-[12px] text-amber-700 dark:text-amber-300">
          Scheduled change to {sub.pendingPlanChange.targetFamily} /{" "}
          {sub.pendingPlanChange.targetTier} on{" "}
          {new Date(sub.pendingPlanChange.effectiveAt).toLocaleDateString()}.
        </p>
      )}

      {editable && (
        <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap gap-2">
            {(["standard", "growth"] as PricingFamily[]).map((f) => (
              <button
                key={f}
                onClick={() => setTargetFamily(f)}
                className={`rounded-full px-3 py-1.5 font-display text-[12px] ${
                  targetFamily === f
                    ? "bg-content-default text-bg-default"
                    : "border border-border-default text-content-subtle"
                }`}
              >
                {f === "growth" ? "Growth" : "Standard"}
              </button>
            ))}
            {(["monthly", "yearly"] as Interval[]).map((i) => (
              <button
                key={i}
                onClick={() => setTargetInterval(i)}
                className={`rounded-full px-3 py-1.5 font-display text-[12px] ${
                  targetInterval === i
                    ? "bg-content-default text-bg-default"
                    : "border border-border-default text-content-subtle"
                }`}
              >
                {i === "yearly" ? "Yearly" : "Monthly"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={TIER_KEYS.length - 1}
              step={1}
              value={TIER_KEYS.indexOf(targetTier)}
              onChange={(e) => setTargetTier(TIER_KEYS[Number(e.target.value)])}
              className="flex-1 accent-content-default"
            />
            <span className="w-14 text-right font-display text-[13px] text-content-default">
              {TIER_LABEL[targetTier]}
              {(() => {
                const p = PRICING_FAMILIES[targetFamily].find((x) => x.tier === targetTier);
                const amt = targetInterval === "yearly" ? p?.price.yearly : p?.price.monthly;
                return amt != null ? ` · $${amt}` : "";
              })()}
            </span>
          </div>

          <button
            onClick={applyChange}
            disabled={!dirty || busy !== null}
            className="flex items-center gap-2 rounded-full bg-content-default px-4 py-2 font-display text-[13px] text-bg-default disabled:opacity-50"
          >
            {busy === "change" && <Loader2 size={13} className="animate-spin" />}
            Apply change
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
        {portalSlug && (
          <button
            onClick={manageBilling}
            disabled={busy !== null}
            className="rounded-full border border-border-default px-4 py-2 font-display text-[13px] text-content-default disabled:opacity-60"
          >
            {busy === "manage" ? "Opening…" : "Manage billing"}
          </button>
        )}
        {ACTIVE_STATUSES.includes(sub.status) &&
          (sub.cancelAtPeriodEnd ? (
            <button
              onClick={() => cancelOrResume(true)}
              disabled={busy !== null}
              className="rounded-full border border-border-default px-4 py-2 font-display text-[13px] text-content-default disabled:opacity-60"
            >
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          ) : (
            <button
              onClick={() => cancelOrResume(false)}
              disabled={busy !== null}
              className="rounded-full px-4 py-2 font-display text-[13px] text-content-error disabled:opacity-60"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          ))}
      </div>
    </div>
  );
}
