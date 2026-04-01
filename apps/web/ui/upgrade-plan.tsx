"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@repo/ui";
import {
  APP_DOMAIN,
  cn,
  PLANS,
  isDowngradePlan,
} from "@repo/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getStripe } from "@/lib/stripe/client";
import { toast } from "sonner";

type Props = {
  plan:      string;            // target plan name e.g. "growth"
  period:    "monthly" | "yearly";
  text?:     string;            // override button label
  variant?:  "primary" | "secondary";
  className?: string;
  disabled?:  boolean;
};

export function UpgradePlanButton({
  plan,
  period,
  text,
  variant   = "primary",
  className,
  disabled  = false,
}: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);

  const {
    slug,
    plan:               currentPlanName,
    billingInterval:    currentInterval,
    subscriptionStatus,
  
  } = useWorkspace();

  // ── Resolve target plan ───────────────────────────────────────────────────
  const targetPlan = PLANS.find(
    (p) => p.name.toLowerCase() === plan.toLowerCase()
  );

  // ── Derive button state ───────────────────────────────────────────────────
  const isCurrentPlan =
    currentPlanName?.toLowerCase() === plan.toLowerCase() &&
    currentInterval === period;

  const isDowngrade = !isCurrentPlan &&
    !!currentPlanName &&
    isDowngradePlan({
      currentPlan: currentPlanName,
      newPlan:     plan,
    });

  const isTrialing = subscriptionStatus === "trialing";

  // Trial label: Starter + monthly + never trialed before + not already active
  // Trial is a one-time signup perk for the Starter plan only.
  // hasUsedTrial is permanently true after the first trial — never resets.
  const showTrialLabel =
    plan.toLowerCase() === "starter" &&
    period === "monthly"             
   
  const buttonLabel = text ?? (() => {
    if (isCurrentPlan && isTrialing) return "Current plan (trial)";
    if (isCurrentPlan)               return "Current plan";
    if (showTrialLabel)              return "Start free trial";
    if (isDowngrade)                 return "Downgrade";
    return "Upgrade";
  })();

  // ── Handle click ──────────────────────────────────────────────────────────
  async function handleClick() {
    if (!slug || disabled || isCurrentPlan) return;

    setLoading(true);

    const queryString = searchParams.toString();
    const baseUrl     = `${APP_DOMAIN}${pathname}${queryString ? `?${queryString}` : ""}`;

    try {
      const res = await fetch(`/api/workspaces/${slug}/billing/upgrade`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          plan,
          period,
          baseUrl,
          onboarding: searchParams.get("workspace") ? "true" : "false",
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Upgrade failed");
      }

      const data = await res.json();

      if (data.url) {
        // Billing portal redirect (existing subscriber switching plans)
        router.push(data.url);
      } else if (data.id) {
        // Stripe Checkout (new subscriber or re-subscribing)
        const stripe = await getStripe();
        await stripe?.redirectToCheckout({ sessionId: data.id });
      }
    } catch (err) {
      console.error("[UpgradePlanButton]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to upgrade plan. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      loading={loading}
      disabled={disabled || isCurrentPlan || loading}
      text={buttonLabel}
      className={cn(
        "flex h-8 w-full items-center justify-center truncate rounded-full px-3 text-[13.5px] font-medium font-display transition",
        isCurrentPlan
          ? "cursor-default border border-neutral-200 !bg-white text-neutral-400 shadow-none"
          : isDowngrade
            ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            : "bg-neutral-900 text-white hover:bg-neutral-800",
        className
      )}
    />
  );
}