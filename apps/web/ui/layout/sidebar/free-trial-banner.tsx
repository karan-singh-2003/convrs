"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { getFreeTrialInfo } from "@/lib/api/workspaces/check-free-trial-days-left";
import Link from "next/link";
import { cn } from "@repo/utils";

export function FreeTrialBanner() {
  const {
    subscriptionStatus,
    freeTrialEndDate,
    slug,
  } = useWorkspace();

  const trial = getFreeTrialInfo(
    freeTrialEndDate ?? new Date()
  );

  if (subscriptionStatus === "inactive") {
    return (
      <div className="fixed left-0 top-0 z-[60] w-full border-b bg-red-50">
        <div className="mx-auto font-display flex h-11 max-w-screen-lg items-center justify-center px-4 text-center">
          <p className="text-sm font-medium text-red-900">
            Your subscription is inactive.&nbsp;
            <Link
              href={`/${slug}/settings/billing`}
              className="font-semibold underline"
            >
              Upgrade
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === "expired") {
    return (
      <div className="fixed left-0 top-0 z-[60] w-full border-b bg-red-50">
        <div className="mx-auto font-display flex h-11 max-w-screen-lg items-center justify-center px-4 text-center">
          <p className="text-sm font-medium text-red-900">
            Your free trial has ended.&nbsp;
            <Link
              href={`/${slug}/settings/billing`}
              className="font-semibold underline"
            >
              Upgrade
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === "trialing") {
    let message = `${trial.daysLeft} days left in your free trial.`;

    if (trial.daysLeft === 1) {
      message = "Your free trial ends tomorrow.";
    } else if (trial.daysLeft <= 3) {
      message = `Only ${trial.daysLeft} days left in your free trial.`;
    }

    return (
      <div
        className={cn(
          "fixed left-0 top-0 z-[60] w-full border-b",
          trial.daysLeft <= 3 ? "bg-red-50" : "bg-amber-50"
        )}
      >
        <div className="mx-auto font-display flex h-11 max-w-screen-lg items-center justify-center px-4 text-center">
          <p
            className={cn(
              "text-sm font-medium",
              trial.daysLeft <= 3
                ? "text-red-900"
                : "text-amber-900"
            )}
          >
            {message}{" "}
            <Link
              href={`/${slug}/settings/billing`}
              className="font-semibold underline"
            >
              Upgrade
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return null;
}