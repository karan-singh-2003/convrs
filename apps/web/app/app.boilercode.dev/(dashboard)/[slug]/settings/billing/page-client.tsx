"use client";
import React from "react";
import { Button } from "@repo/ui";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import IsometricBoxes from "./IsometricBoxes";
import Invoices from "./Invoices";
import { useRouter } from "next/navigation";
import useWorkspace from "@/lib/swr/use-workspace";

const BillingClient = () => {
  const router = useRouter();
  const { slug } = useWorkspace();
  return (
    <div className="space-y-5">
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
        <div className="p-3.5">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium font-display text-neutral-500">
              Current Plan
            </h3>
            <p className="text-[13px] font-display text-neutral-500">
              Current billing cycle: Feb 13, 2026 - Mar 12, 2026
            </p>
          </div>
          <div className="flex items-center gap-x-3 mt-2 ">
            <IsometricBoxes count={1} size={36} />
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-medium font-display text-neutral-500">
                Free
              </p>
              <p className="text-[13px] font-display text-neutral-500">
                $0.00 per month billed monthly
              </p>
            </div>
            <Button
              text="Upgrade "
              variant="secondary"
              className="ml-auto rounded-full h-fit bg-[#EDF3FF] text-[#3A8ED3] text-[12.5px] py-1 px-3 w-fit font-googleSans"
              onClick={() => router.push(`/${slug}/settings/billing/upgrade`)}
            ></Button>
          </div>
        </div>
      </SettingsChildrenLayout>
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
