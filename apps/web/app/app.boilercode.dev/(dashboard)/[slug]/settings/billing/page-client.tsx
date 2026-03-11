"use client";
import React, { useMemo } from "react";
import { Button } from "@repo/ui";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import IsometricBoxes from "./IsometricBoxes";
import Invoices from "./Invoices";
import { useRouter } from "next/navigation";
import useWorkspace from "@/lib/swr/use-workspace";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { getFormattedBillingPeriod } from "@repo/utils";

type BillingData = {
  billingCycle: "monthly" | "yearly";
  billingPeriodStart: number;
};
const BillingClient = () => {
  const router = useRouter();
  const {
    slug,
    plan: workspacePlan,
    loading,
    billingCycleStart,
  } = useWorkspace();

  const planName = workspacePlan ?? "Free";

  const { data, isLoading } = useSWR<BillingData>(
    `/api/workspaces/${slug}/billing`,
    fetcher
  );

  const billingInterval = data?.billingCycle;
  const billingStartDate = data?.billingPeriodStart;

  const billingPeriod = useMemo(
    () =>
      getFormattedBillingPeriod(
        billingStartDate ? billingStartDate * 1000 : undefined, // ← fix
        billingInterval
      ),
    [billingStartDate, billingInterval]
  );
  const [billingStart, billingEnd] = billingPeriod ?? [];

  return (
    <div className="space-y-6">
      <SettingsChildrenLayout
        title="Billing"
        description="For questions about Billing Contact Us"
        className="my-5"
        actions={
          <>
            <Button
              variant="secondary"
              text="View All Plans"
              className="text-sm text-neutral-500"
              onClick={() => router.push(`/${slug}/settings/billing/upgrade`)}
            />
          </>
        }
      >
        <div className="">
          <div className="space-y-0.5 px-3.5 py-2.5 ">
            <h3 className="text-sm font-medium font-display text-neutral-500">
              Current Plan
            </h3>
            <p className="text-[13.5px] font-display text-neutral-500">
              {billingStart && billingEnd
                ? `Billing Cycle: ${billingStart} - ${billingEnd}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-x-3 px-3 py-2.5 border-t border-neutral-200/70   ">
            <IsometricBoxes count={getCount(planName)} size={39} />
            <div className="flex flex-col">
              <p className="text-[14px] font-medium font-display text-neutral-500">
                {loading ? "" : planName}
              </p>
              {/* <p className="text-[14px] font-display text-neutral-500">
                {loading ? "..." : formatPrice(price ?? 0, interval)}
              </p> */}
            </div>
            {planName.toLowerCase() !== "enterprise" && (
              <Button
                text="Upgrade"
                variant="secondary"
                className="ml-auto rounded-full h-fit bg-[#EDF3FF] text-[#3A8ED3] text-[12.5px] py-1 px-3 w-fit font-googleSans"
                onClick={() => router.push(`/${slug}/settings/billing/upgrade`)}
              />
            )}
          </div>
        </div>
      </SettingsChildrenLayout>

      {/* Recent Invoices */}
      <SettingsChildrenLayout
        title="Recent Invoices"
        description="View and track your past invoices and payment history"
        className="my-5"
        actions={<></>}
      >
        <Invoices />
      </SettingsChildrenLayout>
    </div>
  );
};

export default BillingClient;

function getCount(planName: string) {
  switch (planName.toLowerCase()) {
    case "pro":
      return 2;
    case "business":
      return 3;
    case "advanced":
      return 4;
    case "enterprise":
      return 4;
    default:
      return 1;
  }
}
