"use client";
import React from "react";
import { Button } from "@repo/ui";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import IsometricBoxes from "./IsometricBoxes";
import Invoices from "./Invoices";
import { useRouter } from "next/navigation";
import useWorkspace from "@/lib/swr/use-workspace";
import useBilling from "@/lib/swr/use-billing";
import BillingDetails from "./BillingDetails";
import { Plus } from "lucide-react";
import PaymentMethod from "./PaymentMethod";

function formatBillingCycle(start: string, end: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} - ${fmt(end)}`;
}

function formatPrice(price: number | null, interval: string) {
  if (price === null || price === 0) return "$0.00 per month";
  return `$${price.toFixed(2)} per ${interval === "year" ? "month billed yearly" : "month billed monthly"}`;
}

const BillingClient = () => {
  const router = useRouter();
  const { slug, plan: workspacePlan } = useWorkspace();
  const { billing, loading } = useBilling();

  const planName = billing?.planName ?? workspacePlan ?? "Free";
  const price =
    billing?.subscription?.interval === "year"
      ? billing?.yearlyPrice
      : billing?.price;
  const interval = billing?.subscription?.interval ?? "month";

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
              {billing?.billingCycleStart && billing?.billingCycleEnd
                ? `Current billing cycle: ${formatBillingCycle(billing.billingCycleStart, billing.billingCycleEnd)}`
                : loading
                  ? "Loading billing cycle..."
                  : "No active billing cycle"}
            </p>
          </div>
          <div className="flex items-center gap-x-3 px-3 py-2.5 border-t border-neutral-200/70   ">
            <IsometricBoxes count={getCount(planName)} size={39} />
            <div className="flex flex-col">
              <p className="text-[14px] font-medium font-display text-neutral-500">
                {loading ? "Loading..." : planName}
              </p>
              <p className="text-[14px] font-display text-neutral-500">
                {loading ? "..." : formatPrice(price ?? 0, interval)}
              </p>
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
