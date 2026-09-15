"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { getFreeTrialInfo } from "@/lib/api/workspaces/check-free-trial-days-left";
import { BILLING_V2 } from "@/lib/billing/flags";
import Link from "next/link";

export function FreeTrialBanner() {
  const { subscriptionStatus, freeTrialEndDate, slug, subscription } = useWorkspace();

  const trial = getFreeTrialInfo(freeTrialEndDate ?? new Date());
  const isGrowthTrial = BILLING_V2 && subscription?.planFamily === "growth";

  const banner = (message: React.ReactNode) => (
    <div className="fixed left-0 top-0 z-40 w-full border-b border-border-subtle   bg-bg-card">
      <div className="mx-auto flex h-11 max-w-screen-lg items-center justify-center px-4 text-center font-display">
        <p className="text-sm font-medium text-content-default">
          {message}
        </p>
      </div>
    </div>
  );

  if (subscriptionStatus === "inactive") {
    return banner(
      <>
        Your subscription is inactive.{" "}
        <Link
          href={`/${slug}/billing`}
          className="font-semibold underline"
        >
          Upgrade
        </Link>
      </>
    );
  }

  if (subscriptionStatus === "expired") {
    return banner(
      <>
        Your free trial has ended.{" "}
        <Link
          href={`/${slug}/billing`}
          className="font-semibold underline"
        >
          Upgrade
        </Link>
      </>
    );
  }

  if (subscriptionStatus === "trialing") {
    const suffix = isGrowthTrial ? " (covers all your sites)" : "";
    let message = `${trial.daysLeft} days left in your free trial${suffix}.`;

    if (trial.daysLeft === 1) {
      message = `Your free trial ends tomorrow${suffix}.`;
    } else if (trial.daysLeft <= 3) {
      message = `Only ${trial.daysLeft} days left in your free trial${suffix}.`;
    }

    return banner(
      <>
        {message}{" "}
        <Link
          href={`/${slug}/billing`}
          className="font-semibold underline"
        >
          Upgrade
        </Link>
      </>
    );
  }

  return null;
}