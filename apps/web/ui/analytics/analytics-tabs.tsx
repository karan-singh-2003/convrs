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
  requiresUpgrade,
  showPaywall,
  country = "US",
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
          label: "Revenue",
          colorClassName: "text-green-500/50",
          conversions: true,
        },
        {
          id: "conversion_rate",
          label: "Conversion Rate",
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
        <div className="grid w-full grid-cols-2 gap-0 md:grid-cols-3 xl:grid-cols-6">
          {tabs.map(({ id, label, colorClassName }, idx) => {
            const isLiveVisitorsTab = id === "live_visitors";
            const isRevenueTab = label === "Revenue";
            const value = isLiveVisitorsTab
              ? (liveVisitorsCount ?? 0)
              : (totalEvents?.[id] ?? 0);
            const hasData =
              isLiveVisitorsTab || totalEvents?.[id] !== undefined;

            return (
              <div key={id} className="relative z-0 flex min-w-0 w-full">
                <Link
                  className={cn(
                    "relative flex h-full min-h-[134px] w-full flex-col justify-between px-4 py-3",
                    "transition-colors hover:bg-neutral-50 focus:outline-none active:bg-neutral-100",
                    "ring-inset ring-neutral-500 focus-visible:ring-1 sm:first:rounded-tl-xl"
                  )}
                  href={tabHref(id)}
                  aria-current
                >
                  {/* Active tab indicator */}
                  {/* <div
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5 w-full bg-black transition-transform duration-100",
                    tab !== id && "translate-y-[3px]" // Translate an extra pixel to avoid sub-pixel issues
                  )}
                /> */}

                  <div className="flex h-7 items-start gap-2.5 text-[14px] text-neutral-500 sm:h-5 sm:items-center">
                    <span className="font-default font-medium ">{label}</span>
                  </div>

                  <div className=" flex h-12 items-center">
                    {hasData ? (
                      id === "avg_session_duration" ? (
                        <div
                          className={cn(
                            "text-xl text-neutral-600 font-medium font-bricolageGrotesque sm:text-[26px]",
                            showPaywall && "opacity-30"
                          )}
                        >
                          {formatDuration(value)}
                        </div>
                      ) : (
                        <NumberFlow
                          value={value}
                          format={
                            isRevenueTab
                              ? {
                                  style: "currency",
                                  currency: country === "US" ? "USD" : "USD",
                                  currencyDisplay: "symbol", // ensures "$" instead of "US$"
                                }
                              : undefined
                          }
                          locales="en-US"
                          className={cn(
                            "text-xl text-neutral-600 font-medium font-bricolageGrotesque sm:text-[26px]",
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
                  {/* Percentage change badge */}
                  <div className="min-h-5">
                    {(() => {
                      const change = percentageChanges?.[id];
                      const hasChange = change !== undefined && change !== null;
                      const hasDataForChange = isLiveVisitorsTab
                        ? liveVisitorsCount !== undefined
                        : totalEvents?.[id] !== undefined;

                      if (!hasChange || !hasDataForChange) {
                        return null;
                      }

                      const direction = getChangeDirection(change);

                      // Determine colors based on direction
                      let textColor: string;
                      let icon: React.ReactNode;

                      if (direction === "up") {
                        textColor = "text-[#46AE56]";
                        icon = <ArrowUp className="h-3 w-3" />;
                      } else if (direction === "down") {
                        textColor = "text-[#ff3b30]";
                        icon = <ArrowDown className="h-3 w-3" />;
                      } else {
                        // Neutral - orange/yellow shades
                        textColor = "text-[#ff9500]";
                        icon = <span className="text-[#ff9500]">−</span>;
                      }

                      return (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full text-[13.5px] font-display",
                            textColor
                          )}
                        >
                          {icon}
                          <span>{formatPercentageChange(change)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </Link>
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

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
