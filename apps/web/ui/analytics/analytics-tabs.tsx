import {
  AnalyticsResponseOptions,
  AnalyticsSaleUnit,
} from "@/lib/analytics/types";
import { ToggleGroup } from "@repo/ui";
import { cn } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lock,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  formatPercentageChange,
  getChangeDirection,
} from "@/lib/analytics/utils/calculate-percentage-change";


type Tab = {
  id: AnalyticsResponseOptions;
  label: string;
  colorClassName: string;
  conversions: boolean;
};

export function AnalyticsTabs({
  showConversions,
  totalEvents,
  percentageChanges,
  liveVisitorsCount,
  tab,
  tabHref,
  saleUnit,
  setSaleUnit,
  hasRevenueProvider,
  requiresUpgrade,
  showPaywall,
  country = "US",
  currency,
  kpiType,
  kpiLabel
}: {
  showConversions?: boolean;
  totalEvents?: { [key in AnalyticsResponseOptions]: number };
  percentageChanges?: { [key in AnalyticsResponseOptions]?: number | null };
  liveVisitorsCount?: number;
  tab: Tab["id"];
  tabHref: (id: Tab["id"]) => string;
  saleUnit: AnalyticsSaleUnit;
  setSaleUnit: (saleUnit: AnalyticsSaleUnit) => void;
  requiresUpgrade?: boolean;
  showPaywall?: boolean;
  country?: string;
  hasRevenueProvider?: boolean;
  currency?: string;
  kpiType?: "revenue" | "goal";   // ← was "funnel" | "composite", make optional
  kpiLabel?: string;
}) {
  const tabs = useMemo(
    () =>
      [
        {
          id: "clicks",
          label: "Visitors",
          colorClassName: "text-blue-500/50",
          conversions: false,
        },
        {
          id: "revenue",
          label: kpiType === "goal" ? (kpiLabel ?? "Goal") : "Revenue",
          colorClassName: "text-green-500/50",
          conversions: true,
        },
        {
          id: "conversion_rate",
          label: "Conversion",
          colorClassName: "text-purple-500/50",
          conversions: true,
        },
        {
          id: "bounce_rate",
          label: "Bounce Rate",
          colorClassName: "text-red-500/50",
          conversions: false,
        },
        {
          id: "avg_session_duration",
          label: "Avg. Session ",
          colorClassName: "text-green-500/50",
          conversions: false,
        },
        {
          id: "revenue_per_visitor",
          label: "Revenue/visitor",
          colorClassName: "text-teal-500/50",
          conversions: true,
        },
        {
          id: "live_visitors",
          label: "Online Now",
          colorClassName: "text-blue-500/50",
          conversions: false,
        },

      ] as Tab[],
    [showConversions]
  );



  return (
    <div className="w-full overflow-x-hidden">
      <NumberFlowGroup>
        <div className="grid w-full grid-cols-3 gap-0 md:grid-cols-3 xl:grid-cols-7">
          {tabs.map(({ id, label, colorClassName }, idx) => {
            const isLiveVisitorsTab = id === "live_visitors";
            const isRevenueTab = id === "revenue";
            const value = isLiveVisitorsTab
              ? (liveVisitorsCount ?? 0)
              : (totalEvents?.[id] ?? 0);
            const hasData =
              isLiveVisitorsTab || totalEvents?.[id] !== undefined;

            const isClickable = isLiveVisitorsTab
              ? false
              : isRevenueTab
                ? hasRevenueProvider
                : hasData; // clicks, conversion_rate, bounce_rate, avg_session_duration


            const cardContent = (
              <>
                <div className="flex items-start gap-2.5 text-[12.5px] text-content-subtle sm:items-center sm:text-[14.5px] min-w-0">
                  <span
                    className="font-poppins font-medium truncate min-w-0"
                    title={label}
                  >
                    {label}
                  </span>
                </div>
                <div className="flex items-start flex-col gap-y-1 justify-between">
                  <div className="flex md:h-8 items-center">
                    {hasData ? (
                      id === "avg_session_duration" ? (
                        <div
                          className={cn(
                            "text-lg text-content-default font-medium font-bricolageGrotesque sm:text-xl md:text-[26px]",
                            showPaywall && "opacity-30"
                          )}
                        >
                          {formatDuration(value)}
                        </div>
                      ) : isRevenueTab && !hasRevenueProvider ? (
                        // ── No payment provider connected ─────────────────────────
                        <div className="flex items-center leading-tight justify-center">
                          <Minus className="h-4 w-4 text-neutral-400" />
                          <Minus className="h-4 w-4 text-neutral-400" />
                        </div>) : (
                        // <NumberFlow
                        //   value={value}
                        //   format={
                        //     isRevenueTab && kpiType !== "goal"
                        //       ? { style: "currency", currency: currency ?? "USD", currencyDisplay: "symbol" }
                        //       : undefined
                        //   }
                        //   locales="en-US"
                        //   className={cn(
                        //     "text-lg text-neutral-600 font-medium font-alexandria sm:text-xl md:text-[26px]",
                        //     showPaywall && "opacity-30"
                        //   )}
                        // />
                        <NumberFlow
                          value={value}
                          format={
                            isRevenueTab && kpiType !== "goal"
                              ? {
                                style: "currency",
                                currency: currency ?? "USD",
                                currencyDisplay: "symbol",
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                              : {
                                maximumFractionDigits: 2,
                              }
                          }
                          locales="en-US"
                          className={cn(
                            "text-lg text-content-default font-medium font-alexandria sm:text-xl md:text-[26px]",
                            showPaywall && "opacity-30"
                          )}
                        />
                      )
                    ) : requiresUpgrade ? (
                      <div className="block rounded-full bg-neutral-100 p-2.5">
                        <Lock className="h-4 w-4 text-neutral-500" />
                      </div>
                    ) : (
                      <div className="h-9 w-16 animate-pulse rounded-none bg-neutral-200" />
                    )}
                  </div>

                  {/* <div className="min-h-5">
                    {(() => {
                      const change = percentageChanges?.[id];
                      const hasChange =
                        change !== undefined && change !== null;
                      const hasDataForChange = isLiveVisitorsTab
                        ? liveVisitorsCount !== undefined
                        : totalEvents?.[id] !== undefined;

                      // Don't show change indicator for revenue if no provider connected
                      const shouldShowChange = hasChange &&
                        hasDataForChange &&
                        !(isRevenueTab && !hasRevenueProvider);   // ← add this guard

                      if (!shouldShowChange) return null;

                      const direction = getChangeDirection(change);

                      let textColor: string;
                      let icon: React.ReactNode;

                      if (direction === "up") {
                        textColor = "text-[#46AE56]";
                        icon = <ArrowUp className="h-3 w-3" />;
                      } else if (direction === "down") {
                        textColor = "text-[#ff3b30]";
                        icon = <ArrowDown className="h-3 w-3" />;
                      } else {
                        textColor = "text-[#ff9500]";
                        icon = <span className="text-[#ff9500]">−</span>;
                      }

                      return (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full text-[13.5px] font-poppins",
                            textColor
                          )}
                        >
                          {icon}
                          <span>{formatPercentageChange(change)}</span>
                        </div>
                      );
                    })()}
                  </div> */}
                </div>
              </>
            );
            return (
              <div key={id} className="relative z-0 flex min-w-0 w-full">
                {isClickable ? (
                  <Link
                    href={tabHref(id)}
                    aria-current
                    className={cn(
                      "relative flex h-full min-h-[105px]  w-full flex-col gap-y-3 px-3 py-2  sm:px-4 sm:py-3",
                      "transition-colors hover:bg-bg-card focus:outline-none active:bg-bg-card",
                      "ring-inset ring-neutral-500 focus-visible:ring-1 sm:first:rounded-tl-xl"
                    )}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "relative flex h-full min-h-[105px] w-full flex-col gap-y-3 px-3 py-2  sm:px-4 sm:py-3",
                      "ring-inset ring-neutral-500 sm:first:rounded-tl-xl"
                    )}
                  >
                    {cardContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* 
        <div className="relative z-0 ml-5 flex md:min-w-[130px]">
          <div
            className={cn(
              "relative flex h-full min-h-[134px] w-full flex-col justify-between px-4 py-3",
              "ring-inset ring-neutral-500 sm:first:rounded-tl-xl"
            )}
          >
            <div className="flex min-h-5 items-center gap-2.5 text-[13.5px] text-neutral-500">
              <span className="font-default font-medium">Online Now</span>
            </div>

            <div className="flex h-12 items-center">
              <NumberFlow
                value={liveVisitorsCount ?? 0}
                className="text-xl text-neutral-600 font-medium font-bricolageGrotesque sm:text-[26px]"
              />
            </div>

            <div className="min-h-6 text-[13.5px] text-neutral-400 font-display"></div>
          </div>
        </div> */}
      </NumberFlowGroup>
    </div>
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}