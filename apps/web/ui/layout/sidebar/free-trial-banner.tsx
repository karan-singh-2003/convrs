"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { getFreeTrialInfo } from "@/lib/api/workspaces/check-free-trial-days-left";
import Link from "next/link";

export function FreeTrialBanner() {
  const { subscriptionStatus, freeTrialEndDate, slug } = useWorkspace();

  const trial = getFreeTrialInfo(freeTrialEndDate ?? new Date());

  const banner = (message: React.ReactNode) => (
    <div className="fixed left-0 top-0 z-40 w-full border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex h-11 max-w-screen-lg items-center justify-center px-4 text-center font-display">
        <p className="text-sm font-medium text-neutral-600">
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
          href={`/${slug}/settings/billing`}
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
          href={`/${slug}/settings/billing`}
          className="font-semibold underline"
        >
          Upgrade
        </Link>
      </>
    );
  }

  if (subscriptionStatus === "trialing") {
    let message = `${trial.daysLeft} days left in your free trial.`;

    if (trial.daysLeft === 1) {
      message = "Your free trial ends tomorrow.";
    } else if (trial.daysLeft <= 3) {
      message = `Only ${trial.daysLeft} days left in your free trial.`;
    }

    return banner(
      <>
        {message}{" "}
        <Link
          href={`/${slug}/settings/billing`}
          className="font-semibold underline"
        >
          Upgrade
        </Link>
      </>
    );
  }

  return null;
}