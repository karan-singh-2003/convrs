"use client";

import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { UpgradePlanPricingCard } from "@/ui/upgrade-plan-pricing-card";

const page = () => {
  return (
    <PageWidthWrapper size="sm">
      <SettingsChildrenLayout
        title="Billing"
        description="One plan, flexible monthly pricing based on event volume."
        className=""
      >
        <UpgradePlanPricingCard />
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
};

export default page;
