// "use client";

// import { PLANS } from "@repo/utils";
// import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// import { UpgradePlanButton } from "@/ui/upgrade-plan";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { Loader2 } from "lucide-react";

// const EVENT_TIERS = PLANS.map((plan) => ({
//   label:
//     plan.limits.events >= 1_000_000
//       ? `${plan.limits.events / 1_000_000}M`
//       : `${plan.limits.events / 1_000}k`,
//   events: plan.limits.events,
//   monthlyPrice: plan.price.monthly!,
//   yearlyPrice: plan.price.yearly!,
//   name: plan.name,
// }));

// export function UpgradePlanPricingCard() {
//   const { freeTrialEndDate, loading, error } = useWorkspace()
//   if (loading) {
//     return (
//       <div className="flex h-[425px] items-center justify-center">
//         <Loader2 className="h-6 w-6 animate-spin" />
//       </div>
//     )
//   }
//   if (error) {
//     return (
//       <div>
//         {error}
//       </div>
//     )
//   }
//   const freeTrailEnabled = freeTrialEndDate ? freeTrialEndDate > new Date() : false;
//   const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
//     "monthly"
//   );
//   const [selectedIndex, setSelectedIndex] = useState(1);
//   const pillRef = useRef<HTMLDivElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);

//   const selectedTier = EVENT_TIERS[selectedIndex];

//   const monthlyPrice = selectedTier.monthlyPrice;
//   const yearlyPrice = selectedTier.yearlyPrice;

//   const selectedPrice =
//     billingCycle === "yearly"
//       ? selectedTier.yearlyPrice
//       : selectedTier.monthlyPrice;

//   const animatedEvents = useAnimatedNumber(selectedTier.events, 300);
//   const animatedPrice = useAnimatedNumber(selectedPrice, 260);
//   const eventDisplay = useMemo(
//     () => formatEventsForDisplay(animatedEvents),
//     [animatedEvents]
//   );

//   const ariaLabel = useMemo(
//     () =>
//       `Select ${selectedTier.label} events for $${selectedPrice}/${billingCycle === "yearly" ? "yr" : "mo"
//       } on ${billingCycle} billing`,
//     [selectedTier.label, selectedPrice, billingCycle]
//   );

//   // Percentage for the filled track
//   const fillPercent = (selectedIndex / (EVENT_TIERS.length - 1)) * 100;

//   // Consistent track color across webkit and moz
//   const trackFilled = "#1f1f1f";
//   const trackEmpty = "#e8e8e8";

//   useLayoutEffect(() => {
//     const pill = pillRef.current;
//     const container = containerRef.current;
//     if (!pill || !container) return;

//     const containerW = container.getBoundingClientRect().width;
//     const pillW = pill.getBoundingClientRect().width;
//     const paddingPx = 12;

//     const trackW = containerW - paddingPx * 2;
//     const rawLeft = trackW * (fillPercent / 100) + paddingPx;
//     const clamped = Math.min(
//       Math.max(rawLeft, pillW / 2 + 4),
//       containerW - pillW / 2 - 4
//     );

//     pill.style.left = `${clamped}px`;
//   }, [fillPercent]);

//   return (
//     <div className="py-5 sm:py-6">
//       <div className="flex flex-col gap-6">
//         <div className="flex flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
//           <div className="flex w-full flex-col items-start gap-4">
//             <h3 className="px-1 font-display text-[16px] font-medium text-content-default sm:text-[18px] md:text-[20px]">
//               How many Monthly events do you want ?
//             </h3>

//             <div
//               ref={containerRef}
//               className="relative flex w-full items-center rounded-full border border-border-subtle bg-bg-card px-3 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] sm:px-4 sm:py-4"
//             >
//               <div
//                 ref={pillRef}
//                 className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border-subtle bg-bg-default px-3 py-1 font-display text-[13px] font-semibold text-content-default shadow-sm sm:text-[12px] md:text-[13px]"
//               >
//                 {EVENT_TIERS[selectedIndex].label}
//               </div>

//               <input
//                 type="range"
//                 min={0}
//                 max={EVENT_TIERS.length - 1}
//                 step={1}
//                 value={selectedIndex}
//                 onChange={(e) => setSelectedIndex(Number(e.target.value))}
//                 style={
//                   {
//                     "--fill": `${fillPercent}%`,
//                   } as React.CSSProperties
//                 }
//                 className="
//               w-full cursor-pointer appearance-none bg-transparent

//               [&::-webkit-slider-runnable-track]:h-3
//               [&::-webkit-slider-runnable-track]:rounded-full
//               [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,rgb(var(--bg-inverted))_var(--fill),rgb(var(--bg-emphasis))_var(--fill))]

//               [&::-webkit-slider-thumb]:appearance-none
//               [&::-webkit-slider-thumb]:h-0
//               [&::-webkit-slider-thumb]:w-0
//               [&::-webkit-slider-thumb]:opacity-0

//               [&::-moz-range-track]:h-3
//               [&::-moz-range-track]:rounded-full
//               [&::-moz-range-track]:bg-[linear-gradient(to_right,rgb(var(--bg-inverted))_var(--fill),rgb(var(--bg-emphasis))_var(--fill))]

//               [&::-moz-range-thumb]:h-0
//               [&::-moz-range-thumb]:w-0
//               [&::-moz-range-thumb]:border-none
//               [&::-moz-range-thumb]:opacity-0
//             "
//               />
//             </div>
//           </div>

//           <div className="flex w-full flex-col gap-3 sm:flex-row md:w-[480px]">
//             <button
//               type="button"
//               onClick={() => setBillingCycle("monthly")}
//               aria-pressed={billingCycle === "monthly"}
//               className={`flex h-28 flex-col gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors sm:h-32 sm:w-1/2 ${billingCycle === "monthly"
//                   ? "border-border-default bg-bg-emphasis text-content-default"
//                   : "border-border-subtle bg-bg-card text-content-subtle hover:bg-bg-subtle"
//                 }`}
//             >
//               <div className="font-display text-[12px] font-medium tracking-wide text-content-subtle sm:text-[13px] md:text-[14px]">
//                 Monthly
//               </div>

//               <div className="mt-2 font-bricolageGrotesque text-[22px] font-semibold text-content-default sm:text-[26px] md:text-[28px]">
//                 ${Math.round(monthlyPrice)}
//               </div>
//             </button>

//             <button
//               type="button"
//               onClick={() => setBillingCycle("yearly")}
//               aria-pressed={billingCycle === "yearly"}
//               className={`flex h-28 flex-col gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors sm:h-32 sm:w-1/2 ${billingCycle === "yearly"
//                   ? "border-border-default bg-bg-emphasis text-content-default"
//                   : "border-border-subtle bg-bg-card text-content-subtle hover:bg-bg-subtle"
//                 }`}
//             >
//               <div className="font-display text-[12px] font-medium tracking-wide text-content-subtle sm:text-[13px] md:text-[14px]">
//                 Yearly
//               </div>

//               <div className="mt-2 font-bricolageGrotesque text-[22px] font-semibold text-content-default sm:text-[26px] md:text-[28px]">
//                 ${Math.round(yearlyPrice)}
//               </div>
//             </button>
//           </div>
//         </div>

//         <div className="h-px w-full bg-border-subtle" />

//         <div className="flex flex-col items-start justify-between gap-2 px-4 sm:px-6 md:flex-row md:items-center">
//           <div className="flex items-baseline gap-3">
//             <span className="font-display text-[16px] font-semibold text-content-default sm:text-[17px] md:text-[18px]">
//               Total
//             </span>
//           </div>

//           <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between md:w-auto md:gap-x-4">
//             <div>
//               <div className="font-bricolageGrotesque text-[18px] font-semibold text-content-default sm:text-[19px] md:text-[20px]">
//                 ${Math.round(animatedPrice).toLocaleString("en-US")}
//                 {billingCycle === "yearly" ? "/year" : "/month"}
//               </div>

//               <div className="font-display text-[14px] text-content-subtle sm:text-[13px] md:text-[14.5px]">
//                 {billingCycle === "yearly"
//                   ? "billed yearly"
//                   : "save 20% with annual plan"}
//               </div>
//             </div>

//             <UpgradePlanButton
//               showTrialLabel={freeTrailEnabled}
//               plan={selectedTier.name.toLowerCase()}
//               period={billingCycle}
//               className="h-10 w-full rounded-full border-0 bg-bg-inverted font-display text-[15px] font-medium text-content-inverted transition-opacity hover:opacity-90 md:w-[240px]"
//             />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function useAnimatedNumber(target: number, duration = 300) {
//   const [animatedValue, setAnimatedValue] = useState(target);
//   const valueRef = useRef(target);

//   useEffect(() => {
//     const startValue = valueRef.current;
//     const delta = target - startValue;
//     if (delta === 0) return;

//     const startTime = performance.now();
//     let frame = 0;

//     const tick = (now: number) => {
//       const elapsed = now - startTime;
//       const progress = Math.min(elapsed / duration, 1);
//       const eased = 1 - Math.pow(1 - progress, 3);
//       valueRef.current = startValue + delta * eased;
//       setAnimatedValue(valueRef.current);
//       if (progress < 1) frame = requestAnimationFrame(tick);
//     };

//     frame = requestAnimationFrame(tick);
//     return () => cancelAnimationFrame(frame);
//   }, [target, duration]);

//   return animatedValue;
// }

// function formatEventsForDisplay(events: number): {
//   value: number;
//   unit: "k" | "M";
//   decimals: 0 | 1;
// } {
//   if (events <= 0) return { value: 0, unit: "k", decimals: 0 };

//   if (events >= 1_000_000) {
//     const value = events / 1_000_000;
//     const decimals = Number.isInteger(value) ? 0 : 1;
//     return { value, unit: "M", decimals: decimals as 0 | 1 };
//   }

//   return { value: events / 1_000, unit: "k", decimals: 0 };
// }



// ----------------------------------------------------------------------------------------------------
// -----------------------------------------------version2 --------------------------------------------
// ----------------------------------------------------------------------------------------------------


"use client";

import { PRICING_FAMILIES, type PricingFamily } from "@repo/utils";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { UpgradePlanButton } from "@/ui/upgrade-plan";
import useWorkspace from "@/lib/swr/use-workspace";
import { Loader2 } from "lucide-react";

const FAMILY_LABELS: Record<PricingFamily, { label: string; blurb: string }> = {
  standard: { label: "Standard", blurb: "Core analytics" },
  growth: { label: "Growth", blurb: "Adds X/Reddit link attribution & mentions" },
};

function buildEventTiers(family: PricingFamily) {
  return PRICING_FAMILIES[family].map((plan) => ({
    label:
      plan.limits.events >= 1_000_000
        ? `${plan.limits.events / 1_000_000}M`
        : `${plan.limits.events / 1_000}k`,
    events: plan.limits.events,
    monthlyPrice: plan.price.monthly!,
    yearlyPrice: plan.price.yearly!,
    name: plan.name,
  }));
}

export function UpgradePlanPricingCard() {
  const { freeTrialEndDate, loading, error } = useWorkspace();

  const [family, setFamily] = useState<PricingFamily>("standard");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedIndex, setSelectedIndex] = useState(1);
  const pillRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const eventTiers = useMemo(() => buildEventTiers(family), [family]);

  // Keep the same tier SELECTED (by index) when switching family, since
  // both families share the same tier ladder order.
  const selectedTier = eventTiers[selectedIndex];

  const monthlyPrice = selectedTier.monthlyPrice;
  const yearlyPrice = selectedTier.yearlyPrice;

  const selectedPrice = billingCycle === "yearly" ? selectedTier.yearlyPrice : selectedTier.monthlyPrice;

  const animatedEvents = useAnimatedNumber(selectedTier.events, 300);
  const animatedPrice = useAnimatedNumber(selectedPrice, 260);
  const eventDisplay = useMemo(() => formatEventsForDisplay(animatedEvents), [animatedEvents]);

  const fillPercent = (selectedIndex / (eventTiers.length - 1)) * 100;

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const container = containerRef.current;
    if (!pill || !container) return;

    const containerW = container.getBoundingClientRect().width;
    const pillW = pill.getBoundingClientRect().width;
    const paddingPx = 12;

    const trackW = containerW - paddingPx * 2;
    const rawLeft = trackW * (fillPercent / 100) + paddingPx;
    const clamped = Math.min(Math.max(rawLeft, pillW / 2 + 4), containerW - pillW / 2 - 4);

    pill.style.left = `${clamped}px`;
  }, [fillPercent]);

  if (loading) {
    return (
      <div className="flex h-[425px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return <div>{error}</div>;
  }

  const freeTrailEnabled = freeTrialEndDate ? freeTrialEndDate > new Date() : false;

  return (
    <div className="py-5 sm:py-6">
      <div className="flex flex-col gap-6">
        {/* ── Family switcher ── */}
        <div className="flex gap-2 px-4 sm:px-6">
          {(Object.keys(FAMILY_LABELS) as PricingFamily[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamily(f)}
              aria-pressed={family === f}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                family === f
                  ? "border-border-default bg-bg-emphasis text-content-default"
                  : "border-border-subtle bg-bg-card text-content-subtle hover:bg-bg-subtle"
              }`}
            >
              <div className="font-display text-[14px] font-semibold">{FAMILY_LABELS[f].label}</div>
              <div className="font-display text-[13px] text-content-subtle">
                {FAMILY_LABELS[f].blurb}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="flex w-full flex-col items-start gap-4">
            <h3 className="px-1 font-display text-[16px] font-medium text-content-default sm:text-[18px] md:text-[20px]">
              How many Monthly events do you want ?
            </h3>

            <div
              ref={containerRef}
              className="relative flex w-full items-center rounded-full border border-border-subtle bg-bg-card px-3 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] sm:px-4 sm:py-4"
            >
              <div
                ref={pillRef}
                className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border-subtle bg-bg-default px-3 py-1 font-display text-[13px] font-semibold text-content-default shadow-sm sm:text-[12px] md:text-[13px]"
              >
                {eventTiers[selectedIndex].label}
              </div>

              <input
                type="range"
                min={0}
                max={eventTiers.length - 1}
                step={1}
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                style={{ "--fill": `${fillPercent}%` } as React.CSSProperties}
                className="
              w-full cursor-pointer appearance-none bg-transparent

              [&::-webkit-slider-runnable-track]:h-3
              [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,rgb(var(--bg-inverted))_var(--fill),rgb(var(--bg-emphasis))_var(--fill))]

              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:h-0
              [&::-webkit-slider-thumb]:w-0
              [&::-webkit-slider-thumb]:opacity-0

              [&::-moz-range-track]:h-3
              [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:bg-[linear-gradient(to_right,rgb(var(--bg-inverted))_var(--fill),rgb(var(--bg-emphasis))_var(--fill))]

              [&::-moz-range-thumb]:h-0
              [&::-moz-range-thumb]:w-0
              [&::-moz-range-thumb]:border-none
              [&::-moz-range-thumb]:opacity-0
            "
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-[480px]">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              aria-pressed={billingCycle === "monthly"}
              className={`flex h-28 flex-col gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors sm:h-32 sm:w-1/2 ${
                billingCycle === "monthly"
                  ? "border-border-default bg-bg-emphasis text-content-default"
                  : "border-border-subtle bg-bg-card text-content-subtle hover:bg-bg-subtle"
              }`}
            >
              <div className="font-display text-[12px] font-medium tracking-wide text-content-subtle sm:text-[13px] md:text-[14px]">
                Monthly
              </div>
              <div className="mt-2 font-bricolageGrotesque text-[22px] font-semibold text-content-default sm:text-[26px] md:text-[28px]">
                ${Math.round(monthlyPrice)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              aria-pressed={billingCycle === "yearly"}
              className={`flex h-28 flex-col gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors sm:h-32 sm:w-1/2 ${
                billingCycle === "yearly"
                  ? "border-border-default bg-bg-emphasis text-content-default"
                  : "border-border-subtle bg-bg-card text-content-subtle hover:bg-bg-subtle"
              }`}
            >
              <div className="font-display text-[12px] font-medium tracking-wide text-content-subtle sm:text-[13px] md:text-[14px]">
                Yearly
              </div>
              <div className="mt-2 font-bricolageGrotesque text-[22px] font-semibold text-content-default sm:text-[26px] md:text-[28px]">
                ${Math.round(yearlyPrice)}
              </div>
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        <div className="flex flex-col items-start justify-between gap-2 px-4 sm:px-6 md:flex-row md:items-center">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[16px] font-semibold text-content-default sm:text-[17px] md:text-[18px]">
              Total
            </span>
          </div>

          <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between md:w-auto md:gap-x-4">
            <div>
              <div className="font-bricolageGrotesque text-[18px] font-semibold text-content-default sm:text-[19px] md:text-[20px]">
                ${Math.round(animatedPrice).toLocaleString("en-US")}
                {billingCycle === "yearly" ? "/year" : "/month"}
              </div>
              <div className="font-display text-[14px] text-content-subtle sm:text-[13px] md:text-[14.5px]">
                {billingCycle === "yearly" ? "billed yearly" : "save 20% with annual plan"}
              </div>
            </div>

            <UpgradePlanButton
              showTrialLabel={freeTrailEnabled}
              plan={selectedTier.name.toLowerCase()}
              family={family}
              period={billingCycle}
              className="h-10 w-full rounded-full border-0 bg-bg-inverted font-display text-[15px] font-medium text-content-inverted transition-opacity hover:opacity-90 md:w-[240px]"
            />
          </div>
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