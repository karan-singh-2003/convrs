"use client";
import React, { useMemo } from "react";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import IsometricBoxes from "../IsometricBoxes";
import PriceCompareTable from "./price-compare-table";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import useWorkspace from "@/lib/swr/use-workspace";
import { getFormattedBillingPeriod } from "@repo/utils";
import useSWR from "swr";
import { fetcher } from "@repo/utils";

type BillingData = {
  billingCycle: "monthly" | "yearly";
  billingPeriodStart: number;
};

const page = () => {
  const { plan: planName, billingCycleStart, slug } = useWorkspace();

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

  const currency = "USD";
  return (
    <PageWidthWrapper size="xl">
      <SettingsChildrenLayout
        title="Plans"
        description="Designed for every stage of your journey. If you couldn’t find something, message us"
        className="my-5"
      >
        <div>
          <div className="flex items-center gap-x-2 ">
            <div className="bg-[#ececec] text-[#727272]  w-fit font-display font-medium text-[12px] rounded-full px-3 py-0.5">
              Current Plan
            </div>
            <h1 className="text-[#989898] font-display text-[13px]">
              Renews on { " "}
              {billingEnd
                ? new Date(billingEnd).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </h1>
          </div>
          <div className="flex items-center gap-x-3  mt-3">
            <IsometricBoxes count={getCount(planName || "")} size={38} />
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-medium font-display text-neutral-500">
                {planName}
              </p>
              {/* <p className="text-[14px] font-display text-neutral-500">
                ${price} per month billed monthly
              </p> */}
            </div>
          </div>
        </div>
      </SettingsChildrenLayout>
      <PriceCompareTable currency={currency} />
    </PageWidthWrapper>
  );
};

export default page;

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
