"use client";

import { Check, X } from "lucide-react";
import { PRICING_PLAN_COMPARE_FEATURES, isDowngradePlan } from "@repo/utils";
import { PLANS, type PlanDetails } from "@repo/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CSSProperties, ReactNode, useMemo, useState } from "react";
import { cn } from "@repo/utils";
import { ToggleGroup } from "@repo/ui";
import { UpgradePlanButton } from "@/ui/upgrade-plan";
import useWorkspace from "@/lib/swr/use-workspace";

function resolveCheck(
  check: (typeof PRICING_PLAN_COMPARE_FEATURES)[number]["features"][number]["check"],
  planId: string
): boolean {
  if (typeof check === "boolean") return check;
  if (check === undefined) return true;
  return (
    (check as Record<string, boolean>)[planId] ??
    (check as Record<string, boolean>).default ??
    true
  );
}

function resolveText(
  text: (typeof PRICING_PLAN_COMPARE_FEATURES)[number]["features"][number]["text"],
  planId: string,
  plan: PlanDetails
): ReactNode {
  if (typeof text === "function") return text({ id: planId, plan });
  return text;
}

type PricingSectionProps = { currency: "INR" | "USD" };

export default function PriceCompareTable({ currency }: PricingSectionProps) {
  const [mobilePlanIndex, setMobilePlanIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const {
    plan: currentPlan,
    stripeId,
    planTier: currentPlanTier = 1 ,
    billingCycleStart,
  } = useWorkspace();

  const plans: { plan: PlanDetails; planTier: number }[] = useMemo(
    () =>
      ["Pro", "Business", "Advanced", "Enterprise"].map((p) => {
        const planDetails = PLANS.find(({ name }) => name === p)!;
        return { plan: planDetails, planTier: 1 };
      }),
    []
  );

  return (
    <section className="bg-white ">
      <div className="w-full ">
        {/* sticky header */}
        <div className="sticky top-0 z-10">
          <div className="overflow-x-hidden rounded-b-xl @container">
            <div
              className={cn(
                "grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] grid-cols-4 gap-px overflow-hidden rounded-b-xl",
                "max-lg:w-[calc(400cqw+3*32px)] max-lg:translate-x-[calc(-1*var(--index)*(100cqw+32px))] max-lg:gap-x-8 max-lg:transition-transform"
              )}
              style={{ "--index": mobilePlanIndex } as CSSProperties}
            >
              <div className="bg-white sm:block hidden">
                <div className="font-display flex-col gap-y-2 flex items-center justify-center h-full text-sm text-neutral-500">
                  <ToggleGroup
                    options={[
                      { value: "monthly", label: "Monthly" },
                      { value: "yearly", label: "Yearly" },
                    ]}
                    selected={billingCycle}
                    selectAction={(val) =>
                      setBillingCycle(val as "monthly" | "yearly")
                    }
                    optionClassName="text-sm px-3 py-1"
                  />
                  {billingCycle === "yearly" && (
                    <span className="ml-2 rounded-full font-medium font-display px-2 py-0.5 text-sm">
                      Save 20% with yearly billing
                    </span>
                  )}
                </div>
              </div>
              {plans.map(({ plan, planTier }, idx) => {
                const disableCurrentPlan = Boolean(
                  stripeId &&
                  plan.name.toLowerCase() === currentPlan &&
                  planTier === currentPlanTier
                );

                const isDowngrade = Boolean(
                  stripeId &&
                  isDowngradePlan({
                    currentPlan: currentPlan?.toLowerCase() || "free",
                    newPlan: plan.name,
                    currentTier: currentPlanTier,
                    newTier: planTier,
                  })
                );
     
                return (
                  <div
                    key={plan.name}
                    className={cn(
                      "relative flex h-full flex-col gap-4 bg-white p-5",
                      "max-lg:rounded-none"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-semibold text-neutral-600">
                          {plan.name}
                        </h3>
                      </div>
                      <p className="font-display mt-0.5 text-[16px] font-medium text-neutral-600">
                        {plan.name === "Enterprise"
                          ? "Custom"
                          : `$${plan.price[billingCycle]}`}
                        {!disableCurrentPlan && (
                          <span className="ml-1 text-sm text-neutral-500">
                            /{billingCycle === "monthly" ? "mo" : "yr"}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* CTA row — mobile gets prev/next arrow buttons */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="h-full font-display text-sm w-fit rounded-full bg-neutral-100 backdrop-blur-sm border border-neutral-300 px-2 transition-all duration-200 hover:bg-neutral-200 disabled:opacity-30 lg:hidden"
                        disabled={mobilePlanIndex === 0}
                        onClick={() => setMobilePlanIndex((i) => i - 1)}
                      >
                        <ChevronLeft className="size-5 text-neutral-700" />
                      </button>

                      {plan.name.toLowerCase() === "enterprise" &&
                      !disableCurrentPlan ? (
                        <a
                          href="/contact"
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded-full text-[13.5px] font-medium font-display transition-all duration-200",
                            "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                          )}
                        >
                          Contact us
                        </a>
                      ) : (
                        <UpgradePlanButton
                          plan={plan.name.toLowerCase()}
                          period={billingCycle}
                          tier={planTier > 1 ? planTier : undefined}
                          text={
                            currentPlan?.toLowerCase() === "enterprise"
                              ? "Contact us"
                              : (currentPlan?.toLowerCase() === plan.name.toLowerCase() && planTier === currentPlanTier)
                                ? "Current Plan"
                                : isDowngrade
                                  ? "Downgrade"
                                  : "Upgrade"
                          }
                          variant={isDowngrade ? "secondary" : "primary"}
                          disabled={currentPlan?.toLowerCase() === plan.name.toLowerCase() && planTier === currentPlanTier}
                          className={cn(
                            "h-8 w-full rounded-full text-[13.5px] font-medium font-display transition-all duration-200",
                            disableCurrentPlan
                              ? "cursor-default border border-neutral-200 !bg-white text-neutral-400 shadow-none"
                              : isDowngrade
                                ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                : "bg-[#404040] hover:bg-[#4040406e] text-white"
                          )}
                        />
                      )}

                      <button
                        type="button"
                        className="h-full w-fit rounded-full bg-neutral-100 backdrop-blur-sm border border-neutral-300 px-2 transition-all duration-200 hover:bg-neutral-200 disabled:opacity-30 lg:hidden"
                        disabled={mobilePlanIndex >= plans.length - 1}
                        onClick={() => setMobilePlanIndex((i) => i + 1)}
                      >
                        <ChevronRight className="size-5 text-neutral-700" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fade gradient below header */}
          <div className="h-4 bg-linear-to-b from-white" />
        </div>

        {/* ── FEATURE COMPARISON BODY ── */}
        <div className="flex flex-col pb-12">
          {PRICING_PLAN_COMPARE_FEATURES.map((category) => (
            <CompareCategorySection
              key={category.category}
              category={category}
              mobilePlanIndex={mobilePlanIndex}
              plans={plans}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Per-category section with its own container query context ──
function CompareCategorySection({
  category,
  mobilePlanIndex,
  plans,
}: {
  category: (typeof PRICING_PLAN_COMPARE_FEATURES)[number];
  mobilePlanIndex: number;
  plans: { plan: PlanDetails; planTier: number }[];
}) {
  return (
    <div className="w-full  overflow-x-hidden ">
      {/* Category label row — full width, no carousel */}
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
        <h4 className="font-display text-[14.5px] font-medium text-neutral-600">
          {category.category}
        </h4>
      </div>

      {/* Feature rows — each is a 3-col grid using the same carousel technique */}
      {category.features.map((feature) => (
        <div
          key={
            typeof feature.text === "string"
              ? feature.text
              : feature.text.toString()
          }
          className={cn(
            "grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] grid-cols-4",
            "max-lg:w-[calc(400cqw+3*32px)] max-lg:translate-x-[calc(-1*var(--index)*(100cqw+32px))] max-lg:gap-x-8 max-lg:transition-transform"
          )}
          style={{ "--index": mobilePlanIndex } as CSSProperties}
        >
          <div className="px-5 py-4 sm:block hidden">
            <span className="font-display font-medium text-sm text-neutral-500">
              {typeof feature.text === "string" ? feature.text : null}
            </span>
          </div>
          {plans.map(({ plan }, i) => {
            const id = plan.name.toLowerCase();
            const enabled = resolveCheck(feature.check, id);
            return (
              <div
                key={id}
                className={cn(
                  "flex items-center md:justify-center gap-2 border-b border-neutral-200 bg-white px-5 py-4",
                  !enabled && "text-neutral-400",
                  // Fade out non-active on mobile (matching header behaviour)
                  i !== mobilePlanIndex && "max-lg:opacity-0"
                )}
              >
                {enabled ? (
                  <Check className="size-4 shrink-0 text-green-600" />
                ) : (
                  <X className="w-5 h-5 text-neutral-400" />
                )}
                <span className="font-display text-sm md:hidden block text-neutral-600">
                  {resolveText(feature.text, id, plan)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
