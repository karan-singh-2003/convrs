import React from "react";
import { WorkspaceBillingUpgradePageClient } from "./page-client";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import IsometricBoxes from "../IsometricBoxes";
import PriceCompareTable  from "./price-compare-table";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
const page = () => {
 const currency = "USD";
  return (
    <PageWidthWrapper size="lg">
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
              Renews Mar 23, 2026
            </h1>
          </div>
          <div className="flex items-center gap-x-3  mt-3">
            <IsometricBoxes count={1} size={38} />
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-medium font-display text-neutral-500">
                Free
              </p>
              <p className="text-[14px] font-display text-neutral-500">
                $0.00 per month billed monthly
              </p>
            </div>
          </div>
        </div>
      </SettingsChildrenLayout>
      <PriceCompareTable currency={currency} />
    </PageWidthWrapper>
  );
};

export default page;
