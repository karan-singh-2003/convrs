"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@repo/ui";
import { APP_DOMAIN, cn, PLANS, isDowngradePlan } from "@repo/utils";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  plan: string;
  period: "monthly" | "yearly";
  text?: string;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
  showTrialLabel?:boolean
};

export function UpgradePlanButton({
  plan,
  period,
  showTrialLabel,
  text,
  variant = "primary",
  className,
  disabled = false,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);

  const {
    slug,
    plan: currentPlanName,
    billingInterval: currentInterval,
    subscriptionStatus,
  } = useWorkspace();

  // ── Resolve target plan ───────────────────────────────────────────────────
  const targetPlan = PLANS.find(
    (p) => p.name.toLowerCase() === plan.toLowerCase()
  );

  // ── Derive button state ───────────────────────────────────────────────────
  const isCurrentPlan =
    currentPlanName?.toLowerCase() === plan.toLowerCase() ;

  const isDowngrade =
    !isCurrentPlan &&
    !!currentPlanName &&
    isDowngradePlan({
      currentPlan: currentPlanName,
      newPlan: plan,
    });

  const isTrialing = subscriptionStatus === "trialing";



  const buttonLabel =
    text ??
    (() => {
      if (isCurrentPlan && isTrialing) return "Current plan (trial)";
      if (isCurrentPlan) return "Current plan";
      if (showTrialLabel) return "Start free trial";
      if (isDowngrade) return "Downgrade";
      return "Upgrade";
    })();

  // Human-readable plan name for toast messages e.g. "Growth"
  const planDisplayName = targetPlan?.name ?? plan;

  // ── Core upgrade fetch — returns url or null (in-place change) ────────────
  async function performUpgrade(): Promise<string | null> {
    const queryString = searchParams.toString();
    const baseUrl = `${APP_DOMAIN}${pathname}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(`/api/workspaces/${slug}/billing/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        period,
        baseUrl,
        onboarding: searchParams.get("workspace") ? "true" : "false",
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Upgrade failed");
    }

    const data = await res.json();
    return data.url ?? null;
  }

  // ── Handle click ──────────────────────────────────────────────────────────
  async function handleClick() {
    if (!slug || disabled || isCurrentPlan) return;

    setLoading(true);

    const action = isDowngrade ? "Downgrading" : showTrialLabel ? "Starting trial" : "Upgrading";
    const successMsg = isDowngrade
      ? `Downgraded to ${planDisplayName}. Change takes effect at end of billing period.`
      : showTrialLabel
      ? `Your 14-day free trial of ${planDisplayName} has started!`
      : `Upgraded to ${planDisplayName} successfully!`;

    toast.promise(performUpgrade(), {
      loading: `${action} to ${planDisplayName}...`,
      success: (url) => {
        if (url) {
          // Redirect happens after toast resolves
          setTimeout(() => window.location.assign(url), 500);
          return `Redirecting to checkout...`;
        }
        return successMsg;
      },
      error: (err: unknown) => {
        console.error("[UpgradePlanButton]", err);
        return err instanceof Error
          ? err.message
          : "Failed to update plan. Please try again.";
      },
      finally: () => {
        setLoading(false);
      },
    });
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