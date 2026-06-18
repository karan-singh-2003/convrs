"use client";

import { useState } from "react";
import { PLANS } from "@repo/utils";
import { cn } from "@repo/utils";
import { ToggleGroup, Button } from "@repo/ui";
import { Check, X } from "lucide-react";
import { UpgradePlanButton } from "@/ui/upgrade-plan";
import { useOnboardingProgress } from "../../use-onboarding-progress";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import NumberFlow from "@number-flow/react";

const PAID_PLANS = PLANS.filter(
  (p) => p.name !== "Free" && p.name !== "Enterprise"
);
const FREE_PLAN = PLANS.find((p) => p.name === "Free")!;

export function BillingForm() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [selectingFree, setSelectingFree] = useState(false);
  const { continueTo } = useOnboardingProgress();
  const searchParams = useSearchParams();
  const slug = searchParams.get("workspace");

  const handleSelectFree = async () => {
    if (!slug) {
      toast.error("No workspace found");
      return;
    }
    setSelectingFree(true);
    try {
      const res = await fetch(`/api/workspaces/${slug}/billing/select-free`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to select free plan");
        setSelectingFree(false);
        return;
      }
      continueTo("invite ", { slug });
    } catch {
      toast.error("Failed to select free plan");
      setSelectingFree(false);
    }
  };

  return (
    <div className="flex flex-col  items-center gap-6 w-full">
      {/* Billing cycle toggle */}
      <div className="flex flex-col items-center gap-2">
        <ToggleGroup
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
          selected={billingCycle}
          selectAction={(val) => setBillingCycle(val as "monthly" | "yearly")}
          optionClassName="text-sm px-4 py-1 text-neutral-600 font-display"
        />
        {billingCycle === "yearly" && (
          <span className="text-sm font-medium font-display text-neutral-600 ">
            Save 20% with yearly billing
          </span>
        )}
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 w-full gap-3 sm:gap-0">
        {PAID_PLANS.map((plan, index) => {
          const isMostPopular = plan.name === "Business";
          const price =
            billingCycle === "monthly" ? plan.price.monthly : plan.price.yearly;

          const roundedClass =
            index === 0
              ? "rounded-xl md:rounded-l-xl md:rounded-r-none"
              : index === PAID_PLANS.length - 1
                ? "rounded-xl md:rounded-r-xl md:rounded-l-none"
                : "rounded-xl md:rounded-none";

          return (
            <div
              key={plan.name}
              className={`bg-neutral-50 border border-neutral-200/60 flex flex-col p-4 sm:p-6 ${roundedClass}`}
            >
              {/* Plan name + badge */}
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[14.5px] font-semibold text-neutral-600">
                  {plan.name}
                </h3>

                {isMostPopular && (
                  <span className="text-[13px] font-display font-medium text-[#3A8ED3]">
                    Most Popular
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1">
                <span className="font-display text-[24px] font-bold text-neutral-600">
                  $
                  <NumberFlow
                    value={price as number}
                    format={{
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }}
                    className="leading-none font-semibold text-neutral-600 font-display"
                  />
                </span>

                <span className="text-sm font-display text-neutral-500">
                  per {billingCycle === "monthly" ? "month" : "year"}
                </span>
              </div>

              {/* CTA */}
              <UpgradePlanButton
                plan={plan.name.toLowerCase()}
                period={billingCycle}
                
                text="Get Started"
                className="my-4 text-sm rounded-sm bg-neutral-800 h-fit py-1.5"
              />

              {/* Features */}
              <div className="flex-1">
                <p className="text-[13.5px] font-medium text-neutral-600 mb-3">
                  {plan.featureTitle}
                </p>

                <ul className="space-y-2.5">
                  {plan.features?.map((feature) => {
                    const isNegative =
                      feature.name.toLowerCase().startsWith("no ") ||
                      feature.name.toLowerCase().includes("not ");

                    return (
                      <li key={feature.id} className="flex items-center gap-2">
                        {isNegative ? (
                          <X className="size-4 shrink-0 text-neutral-300" />
                        ) : (
                          <Check className="size-4 shrink-0 text-neutral-500" />
                        )}

                        <span
                          className={cn(
                            "text-[13.5px] font-display",
                            isNegative ? "text-neutral-400" : "text-neutral-600"
                          )}
                        >
                          {feature.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free plan option */}
      <div className="flex flex-col items-center gap-2 mt-2 mb-4">
        <Button
          onClick={handleSelectFree}
          loading={selectingFree}
          variant="secondary"
          text="Continue with Free Plan"
          className="text-neutral-600"
        />
      </div>
    </div>
  );
}
