"use client";

import { ToggleGroup } from "@repo/ui";
import { PLANS } from "@repo/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { UpgradePlanButton } from "@/ui/upgrade-plan";

const EVENT_TIERS = PLANS.map((plan) => ({
  label:
    plan.limits.events >= 1_000_000
      ? `${plan.limits.events / 1_000_000}M`
      : `${plan.limits.events / 1_000}k`,
  events: plan.limits.events,
  monthlyPrice: plan.price.monthly!,
  yearlyPrice: plan.price.yearly!,
  name: plan.name,
}));

export function UpgradePlanPricingCard() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [selectedIndex, setSelectedIndex] = useState(1);

  const selectedTier = EVENT_TIERS[selectedIndex];

  const selectedPrice =
    billingCycle === "yearly"
      ? selectedTier.yearlyPrice
      : selectedTier.monthlyPrice;

  const animatedEvents = useAnimatedNumber(selectedTier.events, 300);
  const animatedPrice = useAnimatedNumber(selectedPrice, 260);
  const eventDisplay = useMemo(
    () => formatEventsForDisplay(animatedEvents),
    [animatedEvents]
  );

  const ariaLabel = useMemo(
    () =>
      `Select ${selectedTier.label} events for $${selectedPrice}/${billingCycle === "yearly" ? "yr" : "mo"} on ${billingCycle} billing`,
    [selectedTier.label, selectedPrice, billingCycle]
  );

  const monthlyEquivalent =
    billingCycle === "yearly"
      ? Math.round(selectedTier.yearlyPrice / 12)
      : null;

  // Percentage for the filled track
  const fillPercent =
    EVENT_TIERS.length > 1
      ? (selectedIndex / (EVENT_TIERS.length - 1)) * 100
      : 0;

  return (
    <div className="bg-white p-5">
      <div className="flex flex-col gap-4">
        <div className="font-display flex flex-col items-center justify-center gap-y-1 text-sm text-neutral-500">
          <ToggleGroup
            options={[
              { value: "monthly", label: "Monthly" },
              {
                value: "yearly",
                label: (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span>Yearly</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[13px] font-medium leading-none ${
                        billingCycle === "yearly"
                          ? "bg-[#E4D8FF] text-[#9353E0]"
                          : "bg-[#ece7f7] text-[#b8aad8]"
                      }`}
                    >
                      -20%
                    </span>
                  </span>
                ),
              },
            ]}
            selected={billingCycle}
            selectAction={(val) => setBillingCycle(val as "monthly" | "yearly")}
            optionClassName="text-[15px] w-full justify-center text-center px-3 py-2"
            className="w-full "
          />
        </div>

        <div className="space-y-4 mt-3">
          <div className="mt-1 space-y-1">
            <p className="font-display text-[14.5px] font-medium text-neutral-500">
              Monthly Events
            </p>
          </div>

          <div className="flex flex-col items-start justify-between gap-1 md:flex-row md:items-end">
            <h2 className="font-display text-4xl leading-none font-semibold text-neutral-700 md:text-[38px]">
              {eventDisplay.value.toLocaleString("en-US", {
                minimumFractionDigits: eventDisplay.decimals,
                maximumFractionDigits: eventDisplay.decimals,
              })}
              {eventDisplay.unit}
            </h2>

            <p className="font-default text-sm font-medium text-neutral-500 md:pb-1 md:text-[15px]">
              for
              ${Math.round(animatedPrice).toLocaleString("en-US")}
              {billingCycle === "yearly" ? "/yr" : "/mo"}
              {monthlyEquivalent && (
                <span className="ml-1 text-neutral-400">
                  (~${monthlyEquivalent}/mo)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="relative h-12 flex items-center">
              <input
                type="range"
                min={0}
                max={EVENT_TIERS.length - 1}
                step={1}
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                aria-label={ariaLabel}
                style={
                  {
                    "--fill": `${fillPercent}%`,
                  } as React.CSSProperties
                }
                className="
          w-full cursor-pointer appearance-none bg-transparent

          [&::-webkit-slider-runnable-track]:h-3
          [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#797979_var(--fill),#e5e7eb_var(--fill))]

          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:mt-[-12px]
          [&::-webkit-slider-thumb]:h-8
          [&::-webkit-slider-thumb]:w-8
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:border-[2.5px]
          [&::-webkit-slider-thumb]:border-[#797979]
          [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.25)]

          [&::-moz-range-track]:h-2
          [&::-moz-range-track]:rounded-full
          [&::-moz-range-track]:bg-[linear-gradient(to_right,#8B5CF6_var(--fill),#e5e7eb_var(--fill))]

          [&::-moz-range-thumb]:h-8
          [&::-moz-range-thumb]:w-8
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:border-[2.5px]
          [&::-moz-range-thumb]:border-[#797979]
          [&::-moz-range-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.25)]
        "
              />
            </div>

            <p className="text-center text-sm text-neutral-400 font-display">
              {selectedTier.name} plan · {selectedTier.label} events/mo
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-5 px-5">
          <UpgradePlanButton
            plan={selectedTier.name.toLowerCase()}
            period={billingCycle}
            className="h-11 w-full rounded-full border-0 bg-[#434343] text-[16px] font-medium font-display text-white hover:bg-[#313131] md:text-[16px]"
          />
        </div>
      </div>
    </div>
  );
}

function useAnimatedNumber(target: number, duration = 300) {
  const [animatedValue, setAnimatedValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const startValue = valueRef.current;
    const delta = target - startValue;
    if (delta === 0) return;

    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      valueRef.current = startValue + delta * eased;
      setAnimatedValue(valueRef.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return animatedValue;
}

function formatEventsForDisplay(events: number): {
  value: number;
  unit: "k" | "M";
  decimals: 0 | 1;
} {
  if (events <= 0) return { value: 0, unit: "k", decimals: 0 };

  if (events >= 1_000_000) {
    const value = events / 1_000_000;
    const decimals = Number.isInteger(value) ? 0 : 1;
    return { value, unit: "M", decimals: decimals as 0 | 1 };
  }

  return { value: events / 1_000, unit: "k", decimals: 0 };
}
