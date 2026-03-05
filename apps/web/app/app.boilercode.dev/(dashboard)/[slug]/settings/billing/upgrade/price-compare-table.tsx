"use client";

import { Check, X } from "lucide-react";
import { PRICING_PLAN_COMPARE_FEATURES, isDowngradePlan } from "@repo/utils";
import { PLANS, type PlanDetails } from "@repo/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CSSProperties, ReactNode, useState } from "react";
import { cn } from "@repo/utils";
import { ToggleGroup } from "@repo/ui";
import { UpgradePlanButton } from "@/ui/upgrade-plan";
import useWorkspace from "@/lib/swr/use-workspace";

type PlanKey = "pro" | "business" | "advanced" | "enterprise";
const PAID_PLANS = PLANS.filter((p) => p.name !== "Free");
const PLAN_KEYS: PlanKey[] = ["pro", "business", "advanced", "enterprise"];

function resolveCheck(
  check: boolean | Partial<Record<string, boolean>> | undefined,
  plan: PlanKey
) {
  if (typeof check === "boolean") return check;
  if (typeof check === "object" && check !== null) {
    if (plan in check) return check[plan] ?? true;
    return check["default"] ?? true;
  }
  return true;
}

function resolveText(
  text: string | ((d: { id: string; plan: PlanDetails }) => ReactNode),
  planKey: PlanKey,
  plan: PlanDetails
): ReactNode {
  if (typeof text === "function") return text({ id: planKey, plan });
  return text;
}

type PricingSectionProps = { currency: "INR" | "USD" };

export default function PriceCompareTable({ currency }: PricingSectionProps) {
  const [mobilePlanIndex, setMobilePlanIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const { plan: currentPlan, stripeId } = useWorkspace();

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
              {PAID_PLANS.map((plan, index) => {
                const planKey = PLAN_KEYS[index];
                const price =
                  billingCycle === "monthly"
                    ? plan.price.monthly
                    : plan.price.yearly;
                const isCustom = price === null;

                const planParts = (currentPlan || "free")
                  .toLowerCase()
                  .split(" ");
                const normalizedPlanName = planParts[0]; // e.g. "pro"
                const currentPeriod = planParts[1] as
                  | "monthly"
                  | "yearly"
                  | undefined; // e.g. "monthly"
                const isCurrentPlan =
                  plan.name.toLowerCase() === normalizedPlanName &&
                  (!currentPeriod || currentPeriod === billingCycle);
                const isDowngrade =
                  !!stripeId &&
                  isDowngradePlan({
                    currentPlan: normalizedPlanName,
                    newPlan: plan.name,
                  });

                return (
                  <div
                    key={plan.name}
                    className={cn(
                      "relative flex h-full flex-col gap-4 bg-white p-5",
                      "max-lg:rounded-none",
                      isCurrentPlan && "",
                      index !== mobilePlanIndex && "max-lg:opacity-0"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-semibold text-neutral-600">
                          {plan.name}
                        </h3>
                        {/* {isCurrentPlan && (
                          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white">
                            Current
                          </span>
                        )} */}
                      </div>
                      <p className="font-display mt-0.5 text-[16px] font-medium text-neutral-600">
                        {isCustom ? "Custom" : `$${price}`}
                        {!isCustom && (
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

                      {planKey === "enterprise" ? (
                        <button
                          className={cn(
                            "h-8 w-full rounded-full text-[13.5px] font-medium font-display transition-all duration-200",
                            isCurrentPlan
                              ? "cursor-default border border-neutral-200 text-neutral-400"
                              : "text-black/60"
                          )}
                          disabled={isCurrentPlan}
                        >
                          {isCurrentPlan ? "Current plan" : "Book a call"}
                        </button>
                      ) : (
                        <UpgradePlanButton
                          plan={planKey}
                          period={billingCycle}
                          text={
                            isCurrentPlan
                              ? "Current plan"
                              : isDowngrade
                                ? "Downgrade"
                                : "Get Started"
                          }
                          variant={isDowngrade ? "secondary" : "primary"}
                          disabled={isCurrentPlan}
                          className={cn(
                            "h-8 w-full rounded-full text-[13.5px] font-medium font-display transition-all duration-200",
                            isCurrentPlan
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
                        disabled={mobilePlanIndex >= PAID_PLANS.length - 1}
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
}: {
  category: (typeof PRICING_PLAN_COMPARE_FEATURES)[number];
  mobilePlanIndex: number;
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
          {PLAN_KEYS.map((planKey, i) => {
            const enabled = resolveCheck(feature.check, planKey);
            const plan = PAID_PLANS[i];
            return (
              <div
                key={planKey}
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
                  {resolveText(feature.text, planKey, plan)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
