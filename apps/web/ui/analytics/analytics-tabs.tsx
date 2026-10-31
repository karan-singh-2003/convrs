import {
  AnalyticsResponseOptions,
  AnalyticsSaleUnit,
} from "@/lib/analytics/types";
import { Popover, ToggleGroup } from "@repo/ui";
import { cn } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatPercentageChange,
  getChangeDirection,
} from "@/lib/analytics/utils/calculate-percentage-change";
import { AnalyticsAreaChart } from "./analytics-area-chart";
import { AnalyticsSparkline, ChartPlaceholder } from "./analytics-sparkline";


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
  kpiLabel,
  kpiRevenueMetric,
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
  kpiRevenueMetric?: "revenue" | "mrr";
}) {
  const revenueTabLabel =
    kpiType === "goal"
      ? (kpiLabel ?? "Goal")
      : kpiRevenueMetric === "mrr"
        ? "MRR"
        : "Revenue";
  // Revenue/visitor only makes sense when the workspace KPI is actual
  // revenue — for a goal-based KPI there's no revenue to divide by, so skip
  // the tab entirely rather than showing a meaningless "—".
  const showRevenuePerVisitor = kpiType === "revenue";

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
          label: revenueTabLabel,
          colorClassName: "text-green-500/50",
          conversions: true,
        },
        {
          id: "conversion_rate",
          label: "Conversion rate",
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
        ...(showRevenuePerVisitor
          ? [
            {
              id: "revenue_per_visitor",
              label: "Revenue/visitor",
              colorClassName: "text-teal-500/50",
              conversions: true,
            },
          ]
          : []),
        {
          id: "live_visitors",
          label: "Online Now",
          colorClassName: "text-blue-500/50",
          conversions: false,
        },
      ] as Tab[],
    [showConversions, revenueTabLabel, showRevenuePerVisitor]
  );
  const kpiConfigured = hasRevenueProvider || (kpiType === "goal" && !!kpiLabel);

  const router = useRouter();
  const [kpiMenuOpen, setKpiMenuOpen] = useState(false);

  // Featured KPI defaults to Revenue. It follows the URL `event` param whenever
  // that changes (card links / back-forward), but can also feature KPIs that
  // aren't URL-selectable (Online Now, unconfigured Revenue).
  const [featuredId, setFeaturedId] = useState<Tab["id"]>("revenue");
  const prevTab = useRef(tab);
  useEffect(() => {
    if (prevTab.current === tab) return;
    prevTab.current = tab;
    setFeaturedId(tab);
  }, [tab]);

  const featuredTab =
    tabs.find(({ id }) => id === featuredId) ??
    tabs.find(({ id }) => id === "revenue") ??
    tabs[0];
  const smallTabs = tabs.filter(({ id }) => id !== featuredTab.id);

  const getKpiState = ({ id }: Tab) => {
    const isLiveVisitorsTab = id === "live_visitors";
    const isRevenueTab = id === "revenue" || id === "revenue_per_visitor";
    const value = isLiveVisitorsTab
      ? (liveVisitorsCount ?? 0)
      : (totalEvents?.[id] ?? 0);
    const hasData = isLiveVisitorsTab || totalEvents?.[id] !== undefined;
    const isClickable = isLiveVisitorsTab
      ? false
      : isRevenueTab
        ? kpiConfigured
        : hasData;
    // Online Now is a point-in-time count with no history; revenue-family
    // KPIs have nothing to plot until a KPI source is configured.
    const hasTimeseries = !isLiveVisitorsTab && !(isRevenueTab && !kpiConfigured);
    return { isLiveVisitorsTab, isRevenueTab, value, hasData, isClickable, hasTimeseries };
  };

  const selectKpi = (item: Tab) => {
    setFeaturedId(item.id);
    setKpiMenuOpen(false);
    if (getKpiState(item).isClickable) {
      router.push(tabHref(item.id), { scroll: false });
    }
  };

  const renderValue = (item: Tab, featured: boolean) => {
    const { id } = item;
    const { isRevenueTab, value, hasData } = getKpiState(item);
    const sizeClassName = featured
      ? "text-2xl sm:text-3xl md:text-[40px]"
      : "text-lg sm:text-xl md:text-[30px]";

    return (
      <div className={cn("flex items-center", featured ? "md:h-12" : "md:h-8")}>
        {hasData ? (
          id === "avg_session_duration" ? (
            <div
              className={cn(
                "text-content-default font-medium font-bricolageGrotesque",
                featured ? sizeClassName : "text-lg sm:text-xl md:text-[32px]",
                showPaywall && "opacity-30"
              )}
            >
              {formatDuration(value)}
            </div>
          ) : isRevenueTab && !kpiConfigured ? (
            <div className="flex items-center leading-tight justify-center">
              <Minus className="h-4 w-4 text-neutral-400" />
              <Minus className="h-4 w-4 text-neutral-400" />
    
            </div>
          ) : (
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
                "text-content-default font-medium font-alexandria",
                sizeClassName,
                showPaywall && "opacity-30"
              )}
            />
          )
        ) : requiresUpgrade ? (
          <div className="block rounded-full bg-bg-subtle dark:bg-bg-emphasis p-2.5">
            <Lock className="h-4 w-4 text-content-subtle" />
          </div>
        ) : (
          <div
            className={cn(
              "animate-pulse rounded-none bg-bg-emphasis",
              featured ? "h-12 w-32" : "h-9 w-16"
            )}
          />
        )}
      </div>
    );
  };

  const renderChange = (item: Tab) => {
    const { id } = item;
    const { isLiveVisitorsTab, isRevenueTab } = getKpiState(item);
    const change = percentageChanges?.[id];
    if (change === undefined || change === null) return null;

    const hasDataForChange = isLiveVisitorsTab
      ? liveVisitorsCount !== undefined
      : totalEvents?.[id] !== undefined;

    if (!hasDataForChange) return null;

    if (isRevenueTab && !kpiConfigured) return null;

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
          "inline-flex items-center mt-2 gap-1 rounded-full text-[13.5px] font-alexandria",
          textColor
        )}
      >
        {icon}
        <span>{formatPercentageChange(change)}</span>
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-hidden">
      {/* <NumberFlowGroup>
        <div
          className={cn(
            "grid w-full grid-cols-3 gap-0 md:grid-cols-3",
            tabs.length === 7 ? "xl:grid-cols-7" : "xl:grid-cols-6"
          )}
        >
          {tabs.map(({ id, label, colorClassName }, idx) => {
            const isLiveVisitorsTab = id === "live_visitors";
            const isRevenueTab = id === "revenue" || id === "revenue_per_visitor";
            const value = isLiveVisitorsTab
              ? (liveVisitorsCount ?? 0)
              : (totalEvents?.[id] ?? 0);
            const hasData =
              isLiveVisitorsTab || totalEvents?.[id] !== undefined;

            const isClickable = isLiveVisitorsTab
              ? false
              : isRevenueTab
                ? kpiConfigured
                : hasData;


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
                            "text-lg text-content-default font-medium font-bricolageGrotesque sm:text-xl md:text-[32px]",
                            showPaywall && "opacity-30"
                          )}
                        >
                          {formatDuration(value)}
                        </div>
                      ) : isRevenueTab && !kpiConfigured ? (
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
                            "text-lg text-content-default font-medium font-alexandria sm:text-xl md:text-[30px]",
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

                  <div className="min-h-5">
                    {(() => {
                      const change = percentageChanges?.[id];
                      if (change === undefined || change === null) return null;

                      const hasDataForChange = isLiveVisitorsTab
                        ? liveVisitorsCount !== undefined
                        : totalEvents?.[id] !== undefined;
                      if (!hasDataForChange) return null;

                      // Don't show a change indicator for revenue-family tabs
                      // when no KPI is configured (same gate as the value
                      // itself — see `isRevenueTab && !kpiConfigured` above).
                      if (isRevenueTab && !kpiConfigured) return null;

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
                            "inline-flex items-center mt-2 gap-1 rounded-full text-[13.5px] font-alexandria",
                            textColor
                          )}
                        >
                          {icon}
                          <span>{formatPercentageChange(change)}</span>
                        </div>
                      );
                    })()}
                  </div>
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
      
      </NumberFlowGroup> */}
      
        <NumberFlowGroup>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {(() => {
              const { id, label } = featuredTab;
              const { hasTimeseries, isRevenueTab } = getKpiState(featuredTab);

              return (
                <div className="relative z-0 col-span-full flex min-w-0 w-full flex-col gap-y-0 rounded-2xl border border-border-subtle bg-bg-card  sm:rounded-3xl ">
                  <div className="flex px-4 pt-4 sm:px-7 sm:pt-5 min-w-0 flex-col items-start">
                    <Popover
                      openPopover={kpiMenuOpen}
                      setOpenPopover={setKpiMenuOpen}
                      align="start"
                      popoverContentClassName="rounded-xl bg-bg-card"
                      content={
                        <div className="grid w-full gap-px p-1.5 sm:w-52">
                          {tabs.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => selectKpi(item)}
                              className={cn(
                                "flex h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm font-medium font-default text-content-default transition-colors ",
                                // item.id === id && "bg-bg-subtle"
                              )}
                            >
                              <span className="truncate">{item.label}</span>
                              {item.id === id && (
                                <Check className="size-4 shrink-0 text-content-subtle" />
                              )}
                            </button>
                          ))}
                        </div>
                      }
                    >
                      <button
                        type="button"
                        aria-label="Select KPI"
                        className="flex min-w-0 items-center gap-1.5 rounded-md text-[12.5px] text-content-subtle transition-colors hover:text-content-default focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500 sm:text-[15px]"
                      >
                        <span className="font-poppins font-medium truncate min-w-0" title={label}>
                          {label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform",
                            kpiMenuOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </Popover>

                    <div className="mt-1 flex flex-col items-start">
                      {renderValue(featuredTab, true)}
                      {/* <div className="min-h-5">{renderChange(featuredTab)}</div> */}
                    </div>
                  </div>

                  <div className="relative px-3 flex h-[220px] w-full items-center justify-center overflow-hidden rounded-xl sm:h-[280px]">
                    {hasTimeseries ? (
                      <AnalyticsAreaChart
                        resource={id as Exclude<AnalyticsResponseOptions, "live_visitors">}
                      />
                    ) : (
                      <ChartPlaceholder
                        size="lg"
                        label={
                          isRevenueTab
                            ? "No data — connect a revenue provider or set a goal KPI"
                            : "No data — real-time count only"
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {smallTabs.map((item) => {
              const { id, label } = item;
              const { isClickable, hasTimeseries } = getKpiState(item);

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
                    {renderValue(item, false)}
                    {/* <div className="min-h-5">{renderChange(item)}</div> */}
                  </div>

                  {/* Bleeds to the card edges; fixed height keeps cards uniform */}
                  <div className="-mx-4 mt-auto h-24">
                    {hasTimeseries ? (
                      <AnalyticsSparkline
                        resource={id as Exclude<AnalyticsResponseOptions, "live_visitors">}
                      />
                    ) : (
                      <ChartPlaceholder />
                    )}
                  </div>
                </>
              );

              const cardClassName = cn(
                "relative flex h-full min-h-[105px] w-full flex-col gap-y-1 overflow-hidden rounded-2xl border border-border-subtle bg-bg-card px-4 pt-3 text-left",
                "transition-colors  focus:outline-none active:bg-bg-muted",
                "ring-inset ring-neutral-500 focus-visible:ring-1"
              );

              return (
                <div key={id} className="relative z-0 flex min-w-0 w-full">
                  {isClickable ? (
                    <Link
                      href={tabHref(id)}
                      aria-current
                      onClick={() => setFeaturedId(id)}
                      className={cardClassName}
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    // Not URL-selectable, but can still be featured locally
                    <button
                      type="button"
                      onClick={() => setFeaturedId(id)}
                      className={cardClassName}
                    >
                      {cardContent}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
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