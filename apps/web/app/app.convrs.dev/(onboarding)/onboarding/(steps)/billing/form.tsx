"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PRICING_FAMILIES,
  TIER_KEYS,
  formatEventLimit,
  type PricingFamily,
  type TierKey,
} from "@repo/utils";
import { Button } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import useBillingContext from "@/lib/swr/use-billing-context";
import { useOnboardingProgress } from "../../use-onboarding-progress";

type Interval = "monthly" | "yearly";

function price(family: PricingFamily, tier: TierKey, interval: Interval): number | null {
  const plan = PRICING_FAMILIES[family].find((p) => p.tier === tier);
  return interval === "yearly" ? plan?.price.yearly ?? null : plan?.price.monthly ?? null;
}

export function BillingForm() {
  const { continueTo } = useOnboardingProgress();
  const { id: workspaceId, slug } = useWorkspace();
  const { billingContext } = useBillingContext();

  const [family, setFamily] = useState<PricingFamily>("standard");
  const [tier, setTier] = useState<TierKey>("t10k");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState<string | null>(null);

  const amount = price(family, tier, interval);
  const events = PRICING_FAMILIES[family].find((p) => p.tier === tier)?.limits.events ?? 0;
  const trialAvailable = billingContext?.trialAvailable ?? true;

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

  async function continueToPayment() {
    if (!workspaceId) return;
    setBusy("checkout");
    try {
      const json = await post("/api/subscriptions", {
        intent: family,
        tier,
        interval,
        targetWorkspaceId: workspaceId,
        onboarding: true,
      });
      if (json.checkoutUrl) {
        window.location.assign(json.checkoutUrl as string);
        return;
      }
      continueTo("script", slug ? { slug } : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setBusy(null);
    }
  }

  async function startTrial() {
    if (!slug) return;
    setBusy("trial");
    try {
      await post(`/api/workspaces/${slug}/billing/start-free-trial`, { family, tier });
      toast.success("Your 14-day free trial has started.");
      continueTo("script", { slug });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start trial");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div className="flex gap-2">
        {(["standard", "growth"] as PricingFamily[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamily(f)}
            className={`flex-1 rounded-lg border px-3 py-2 font-display text-[13px] transition ${
              family === f
                ? "border-black bg-white text-neutral-800"
                : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            {f === "growth" ? "Growth — up to 30 sites, X/Reddit attribution" : "Standard — one site"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["monthly", "yearly"] as Interval[]).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            className={`rounded-full border px-3 py-1.5 font-display text-[12px] transition ${
              interval === i
                ? "border-black bg-white text-neutral-800"
                : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            {i === "yearly" ? "Yearly" : "Monthly"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <input
          type="range"
          min={0}
          max={TIER_KEYS.length - 1}
          step={1}
          value={TIER_KEYS.indexOf(tier)}
          onChange={(e) => setTier(TIER_KEYS[Number(e.target.value)])}
          className="w-full accent-black"
        />
        <div className="mt-2 flex items-center justify-between font-display text-[13px] text-neutral-700">
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            {formatEventLimit(events)}
          </span>
          <span>
            {amount === null ? "—" : `$${amount}/${interval === "yearly" ? "yr" : "mo"}`}
          </span>
        </div>
      </div>

      <Button
        onClick={continueToPayment}
        loading={busy === "checkout"}
        disabled={busy !== null || !workspaceId}
        text="Continue to payment"
        className="font-display text-white"
      />

      <div className="flex flex-col items-center gap-2">
        {trialAvailable && (
          <button
            type="button"
            onClick={startTrial}
            disabled={busy !== null}
            className="flex items-center gap-1.5 font-display text-sm text-neutral-500 transition hover:text-neutral-700 disabled:opacity-50"
          >
            {busy === "trial" && <Loader2 size={13} className="animate-spin" />}
            Start a 14-day free trial (no card)
          </button>
        )}
        <button
          type="button"
          onClick={() => continueTo("script", slug ? { slug } : undefined)}
          disabled={busy !== null}
          className="font-display text-sm text-neutral-400 transition hover:text-neutral-600 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
