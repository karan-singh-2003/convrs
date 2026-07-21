"use client";

import { Button, Tooltip, useMediaQuery } from "@repo/ui";
import { cn, getPrettyUrl } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { Maximize2, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ComponentProps,
  Dispatch,
  memo,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { areEqual, FixedSizeList } from "react-window";
import { AnalyticsContext } from "./analytics-providers";

type BarListDatum = {
  icon?: ReactNode;
  title: string;
  filterValue?: string;
  count: number;
  revenue: number;
  linkId?: string;
  /** Optional: only render the conversion-rate tooltip row if a section supplies this */
  conversionRate?: number;
  /** When set without filter UI (e.g. billing usage modal), row navigates here */
  href?: string;
};

type Metric = "clicks" | "revenue";

/** Picks the metric that should drive sort order / primary display */
function getMetricValue(d: { count: number; revenue: number }, metric: Metric) {
  return metric === "revenue" ? (d.revenue ?? 0) : (d.count ?? 0);
}

// Clamp helper so rounding / bad data never pushes a bar past its track
function clampPercent(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

export function BarList({
  tab,
  unit,
  metric = "clicks",
  data,
  totalVisitors,
  allData,
  hoverBackground,
  maxValue,
  setShowModal,
  limit,
  selectedFilterValues,
  activeFilterValues,
  onToggleFilter,
  onClearFilter,
  onClearSelection,
  onApplyFilterValues,
  placeholder,
  onRowFilterItem,
  onExpandRow,
  currency = "USD",
  emptyState,
  kpiLabel = "Revenue",       // NEW: what to call the secondary metric
  isGoalKpi = false,
  kpiConfigured = true,
}: {
  placeholder?: string;
  tab: string;
  unit: string;
  /** Which metric ("clicks" | "revenue") is currently active for this card — drives sort + primary bar */
  metric?: Metric;
  totalVisitors?: number;
  data: BarListDatum[];
  allData?: BarListDatum[];
  maxValue: number;
  barBackground: string;
  hoverBackground: string;
  filterSelectedBackground?: string;
  filterSelectedHoverBackground?: string;
  filterHoverClass?: string;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  limit?: number;
  selectedFilterValues?: string[];
  activeFilterValues?: string[];
  onToggleFilter?: (val: string) => void;
  onClearFilter?: () => void;
  onClearSelection?: () => void;
  onRowFilterItem?: (val: string) => void;
  onApplyFilterValues?: (values: string[]) => void;
  onExpandRow?: (filterValue: string) => void;
  currency?: string;
  /** Optional custom empty state content when there's nothing to show */
  emptyState?: ReactNode;
  /** Label for the second metric slot when it isn't real revenue (e.g. a goal name) */
  kpiLabel?: string;
  /** When true, the "revenue" field actually holds a goal-completion count — format as a number, not currency */
  isGoalKpi?: boolean;
  kpiConfigured?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [modalSelectedValues, setModalSelectedValues] = useState<string[]>(
    activeFilterValues ?? []
  );

  useEffect(() => {
    if (!limit) {
      setModalSelectedValues(activeFilterValues ?? []);
    }
  }, [activeFilterValues, limit]);

  const handleModalToggle = useCallback((val: string) => {
    setModalSelectedValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }, []);

  const hasSelection = (selectedFilterValues?.length ?? 0) > 0;
  const hasModalSelection = modalSelectedValues.length > 0;

  const effectiveSelectedValues = !limit
    ? modalSelectedValues
    : selectedFilterValues;

  const sourceData = !limit && allData ? allData : data;


  // Sort is always driven by the active metric chosen via the card's toggle button
  const sortedSourceData = useMemo(
    () =>
      [...(sourceData ?? [])].sort(
        (a, b) => getMetricValue(b, metric) - getMetricValue(a, metric)
      ),
    [sourceData, metric]
  );

  // Two independent totals so each bar's SHARE label reflects its own metric, not the active one
  const totalCount = useMemo(
    () => sortedSourceData.reduce((sum, item) => sum + (item.count ?? 0), 0),
    [sortedSourceData]
  );
  const totalRevenue = useMemo(
    () => sortedSourceData.reduce((sum, item) => sum + (item.revenue ?? 0), 0),
    [sortedSourceData]
  );
  const totalSum = metric === "revenue" ? totalRevenue : totalCount;

  // Per-metric max so each bar's WIDTH is normalized against its own metric's
  // largest value in the list. Two rows sharing the same click count but
  // different revenue will now correctly render different revenue-bar widths
  // without the clicks-bar and revenue-bar ever overflowing/clipping each other.
  const maxCount = useMemo(
    () => sortedSourceData.reduce((m, item) => Math.max(m, item.count ?? 0), 0),
    [sortedSourceData]
  );
  const maxRevenue = useMemo(
    () => sortedSourceData.reduce((m, item) => Math.max(m, item.revenue ?? 0), 0),
    [sortedSourceData]
  );

  const [inputValue, setInputValue] = useState("");

  const filteredData = useMemo(() => {
    if (limit) {
      return sortedSourceData.slice(0, limit);
    }

    const searchLower = search.trim().toLowerCase();

    return searchLower
      ? sortedSourceData.filter((d) =>
        (d.title ?? d.filterValue ?? "").toLowerCase().includes(searchLower)
      )
      : sortedSourceData;
  }, [sortedSourceData, limit, search]);

  const { isMobile } = useMediaQuery();

  const virtualize = filteredData.length > 100;

  const itemProps = filteredData.map((data) => ({
    ...data,
    count: data.count ?? 0,
    revenue: data.revenue ?? 0,
    maxValue,
    maxCount,
    maxRevenue,
    totalSum,
    totalCount,
    totalRevenue,
    totalVisitors,
    tab,
    unit,
    metric,
    kpiLabel,
    isGoalKpi,
    kpiConfigured,
    setShowModal,
    hoverBackground,
    limit,
    isSelected: data.filterValue
      ? (effectiveSelectedValues ?? []).includes(data.filterValue)
      : false,
    onFilterClick: data.filterValue
      ? !limit
        ? () => handleModalToggle(data.filterValue!)
        : onToggleFilter
          ? () => onToggleFilter(data.filterValue!)
          : undefined
      : undefined,

    onRowClick:
      data.filterValue && onRowFilterItem
        ? !limit
          ? () => {
            onRowFilterItem(data.filterValue!);
            setShowModal(false);
          }
          : () => onRowFilterItem(data.filterValue!)
        : undefined,
    onExpandRow:
      data.filterValue && onExpandRow
        ? () => onExpandRow(data.filterValue!)
        : undefined,
    currency,
  }));

  const isEmpty = filteredData.length === 0;

  const bars = isEmpty ? (
    <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1 px-4 py-8 text-center">
      {emptyState ?? (
        <>
          <span className="text-sm font-medium text-neutral-600">
            No results
          </span>
          {search && (
            <span className="text-xs text-neutral-400">
              Try a different search term
            </span>
          )}
        </>
      )}
    </div>
  ) : (
    <NumberFlowGroup>
      <div className="relative grid h-full auto-rows-min grid-cols-1">
        {virtualize ? (
          <AutoSizer>
            {({ width, height }) => (
              <FixedSizeList
                width={width}
                height={height}
                itemCount={filteredData.length}
                itemSize={40}
                itemData={itemProps}
              >
                {VirtualLineItem}
              </FixedSizeList>
            )}
          </AutoSizer>
        ) : (
          filteredData.map((data, idx) => (
            <LineItem key={data.filterValue ?? data.title ?? idx} {...itemProps[idx]} />
          ))
        )}
      </div>
    </NumberFlowGroup>
  );

  if (limit) {
    return bars;
  } else {
    return (
      <>
        <div className="border-b border-border-subtle px-2 py-2 sm:px-4 sm:py-3">
          <div className="flex w-full overflow-hidden rounded-full border border-transparent bg-bg-subtle transition-colors focus-within:border-border-default focus-within:bg-bg-card">
            <input
              type="text"
              placeholder={`Search ${placeholder ?? ""}`}
              autoFocus={!isMobile}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(inputValue);
                }
              }}
              className="w-full min-w-0 rounded-full border-0 bg-transparent px-4 py-2 text-sm font-default text-content-default placeholder:text-content-subtle focus:outline-none focus:ring-0 sm:px-5 sm:py-2.5 sm:text-[15px]"
            />

            <button
              type="button"
              onClick={() => setSearch(inputValue)}
              aria-label="Search"
              className="flex shrink-0 items-center justify-center bg-bg-inverted px-3 text-content-inverted transition-colors hover:opacity-90 sm:px-4"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative my-2">
          <div className="h-[45vh] overflow-auto scrollbar pb-3 sm:pb-4 sm:h-[50vh] md:h-[40vh]">
            {bars}
          </div>
        </div>
      </>
    );
  }
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
  JPY: "ja-JP",
  CHF: "de-CH",
  CNY: "zh-CN",
  KRW: "ko-KR",
  HKD: "zh-HK",
  NZD: "en-NZ",
  NOK: "nb-NO",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  BRL: "pt-BR",
  IDR: "id-ID",
};

// What to call the "count" metric in the tooltip, based on the section's data unit
const COUNT_LABELS: Record<string, string> = {
  leads: "Leads",
  sales: "Sales",
  clicks: "Visitors",
};

// Single source of truth for bar + tooltip-swatch colors, so the legend
// always matches what's actually drawn on the bar.
const METRIC_COLORS = {
  clicks: {
    active: "bg-bg-bar-primary",
    inactive: "bg-bg-bar-secondary",
    swatch: "bg-bg-bar-primary",
  },
  revenue: {
    active: "bg-bg-bar-primary",
    inactive: "bg-bg-bar-secondary",
    swatch: "bg-bg-bar-primary",
  },
} as const;

const TOOLTIP_WIDTH = 224; // matches w-56 on desktop; clamped down on narrow viewports
const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 8; // min distance from screen edge

export function LineItem({
  icon,
  title,
  count,
  revenue,
  conversionRate,
  maxCount,
  maxRevenue,
  totalSum,
  totalCount,
  totalRevenue,
  tab,
  totalVisitors,
  unit,
  metric = "clicks",
  kpiLabel = "Revenue",   // NEW
  isGoalKpi = false,      // NEW
  kpiConfigured = true,
  setShowModal,
  hoverBackground,
  linkData,
  limit,
  isSelected,
  onRowClick,
  onFilterClick,
  href,
  onExpandRow,
  currency,
}: {
  icon?: ReactNode;
  title: string;
  count: number;
  revenue: number;
  conversionRate?: number;
  totalVisitors?: number;
  maxCount: number;
  maxRevenue: number;
  totalSum: number;
  totalCount: number;
  totalRevenue: number;
  tab: string;
  unit: string;
  metric?: Metric;
  kpiLabel?: string;      // NEW
  isGoalKpi?: boolean;    // NEW
  kpiConfigured?: boolean;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  hoverBackground: string;
  linkData?: any;
  limit?: number;
  isSelected?: boolean;
  onFilterClick?: () => void;
  href?: string;
  onRowClick?: () => void;
  onExpandRow?: () => void;
  currency?: string;
}) {
  const safeCount = count ?? 0;
  const safeRevenue = revenue ?? 0;

  const [filterButtonHovered, setFilterButtonHovered] = useState(false);
  const [tooltipResetKey, setTooltipResetKey] = useState(0);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
    width: number;
  } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const { saleUnit } = useContext(AnalyticsContext);
  const { isMobile } = useMediaQuery();
  const router = useRouter();



  // Whichever metric is "active" (per the card's toggle) drives the main number + which bar is bold
  const isRevenueActive = metric === "revenue";
  const activeValue = isRevenueActive ? safeRevenue : safeCount;

  // Each bar's width reflects its share of the LARGEST value for that same
  // metric across the whole list — this keeps the two bars on independent,
  // meaningful scales and guarantees neither can overflow or clip the other,
  // even when e.g. two rows share the same click count but differ in revenue.


  // Right-side "%" label reflects the active metric's share of the total
  const percentage = clampPercent(
    tab === "goal"
      ? Math.round((activeValue / (totalVisitors || 1)) * 1000) / 10
      : Math.round((activeValue / (totalSum || 1)) * 1000) / 10
  );

  const isModalView = !limit;

  const locale = CURRENCY_LOCALES[currency ?? "USD"] ?? "en-US";

  const formatCurrency = useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency ?? "USD",
        currencyDisplay: "symbol",
      }).format(v || 0),
    [locale, currency]
  );

  const formatNumber = useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale, {
        notation: (v || 0) > 999999 ? "compact" : "standard",
      }).format(v || 0),
    [locale]
  );
  const formatKpiValue = isGoalKpi ? formatNumber : formatCurrency;

  const revenuePerVisitor = safeCount > 0 ? safeRevenue / safeCount : 0;
  const countLabel = COUNT_LABELS[unit] ?? "Visitors";

  // Compute tooltip position ONCE on hover-enter so it doesn't fight with the
  // CSS group-hover transitions already running on the row. Recomputed on
  // resize/orientation-change too, so rotating a phone doesn't leave it stale.
  const computeTooltipPos = useCallback(() => {
    if (isMobile) return;
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportWidth = window.innerWidth;
    const width = Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_PADDING * 2);
    const halfTooltip = width / 2;
    const rowCenterX = rect.left + rect.width / 2;



    const clampedCenterX = Math.min(
      Math.max(rowCenterX, halfTooltip + VIEWPORT_PADDING),
      viewportWidth - halfTooltip - VIEWPORT_PADDING
    );

    const estimatedTooltipHeight = 150;
    const spaceAbove = rect.top;
    const placeAbove = spaceAbove > estimatedTooltipHeight + TOOLTIP_GAP;
    const leftAdded = 114
    setTooltipPos({
      top: placeAbove
        ? rect.top + 4 * TOOLTIP_GAP
        : rect.bottom + 2 * TOOLTIP_GAP,
      left: clampedCenterX - leftAdded,
      placement: placeAbove ? "above" : "below",
      width,
    });
  }, [isMobile]);
  const clicksPercentage = clampPercent(
    maxCount && maxCount > 0 ? (safeCount / maxCount) * 100 : 0
  );

  const revenuePercentage = clampPercent(
    maxRevenue && maxRevenue > 0 ? (safeRevenue / maxRevenue) * 100 : 0
  );
  const handleRowMouseEnter = useCallback(() => {
    if (isMobile) return;
    computeTooltipPos();
    setIsRowHovered(true);
  }, [isMobile, computeTooltipPos]);

  const handleRowMouseLeave = useCallback(() => {
    setIsRowHovered(false);
  }, []);

  useEffect(() => {
    if (!isRowHovered) return;
    const onResize = () => computeTooltipPos();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [isRowHovered, computeTooltipPos]);



  // Two thin, independently-scaled bars stacked vertically: the active
  // metric renders on top (bold color, taller), the other sits underneath
  // (dim, thinner) — purely as a visual reference, never competing for the
  // same horizontal space, so widths never overflow or clip each other.
  const clicksBar = {
    key: "clicks",
    percentage: clicksPercentage,
    colorClass: isRevenueActive
      ? METRIC_COLORS.clicks.inactive
      : METRIC_COLORS.clicks.active,
  };

  const revenueBar = {
    key: "revenue",
    percentage: revenuePercentage,
    colorClass: isRevenueActive
      ? METRIC_COLORS.revenue.active
      : METRIC_COLORS.revenue.inactive,
  };

  const orderedBars = isRevenueActive
    ? [revenueBar, clicksBar]
    : [clicksBar, revenueBar];

  const lineItem = (
    <div className="z-10 flex min-w-0 items-center space-x-2 overflow-hidden">
      {icon ? (
        onFilterClick ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFilterClick();
            }}
            onMouseEnter={() => {
              setFilterButtonHovered(true);
              setTooltipResetKey((k) => k + 1);
            }}
            onMouseLeave={() => setFilterButtonHovered(false)}
            aria-label={`${isSelected ? "Remove" : "Add"} filter: ${title}`}
            aria-pressed={isSelected}
            className="flex size-5 sm:size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-transparent"
          >
            {icon}
          </button>
        ) : (
          <div className="flex size-5 sm:size-6 shrink-0 items-center justify-center">
            {icon}
          </div>
        )
      ) : (
        <div className="size-0 shrink-0" aria-hidden="true" />
      )}
      {tab === "links" && linkData ? (
        <h1 className="truncate">{getPrettyUrl(title)}</h1>
      ) : tab === "urls" ? (
        <Tooltip
          key={tooltipResetKey}
          content={`[${title}](${title})`}
          contentClassName="max-w-[min(90vw,32rem)]"
          disabled={filterButtonHovered}
        >
          <div className="truncate text-[13px] text-content-default font-display sm:text-[16px]">
            {getPrettyUrl(title)}
          </div>
        </Tooltip>
      ) : (
        <div className="truncate text-[13px] text-content-default font-display sm:text-[15px]">
          {title}
        </div>
      )}
    </div>
  );
  // const PRIMARY_MAX = 50;
  // const SECONDARY_MAX = 50;

  // const hasClicks = safeCount > 0 && maxCount > 0;
  // const hasRevenue = safeRevenue > 0 && maxRevenue > 0;

  // let clicksWidth = 0;
  // let revenueWidth = 0;

  // let clicksLeft = 0;
  // let revenueLeft = 0;

  // const normalizedClicks =
  //   hasClicks ? safeCount / maxCount : 0;

  // const normalizedRevenue =
  //   hasRevenue ? safeRevenue / maxRevenue : 0;

  // if (isRevenueActive) {
  //   revenueWidth = hasRevenue
  //     ? (safeRevenue / maxRevenue) * PRIMARY_MAX
  //     : 0;

  //   revenueLeft = 0;

  //   clicksLeft = revenueWidth;

  //   clicksWidth = hasClicks
  //     ? (safeCount / maxCount) * SECONDARY_MAX
  //     : 0;
  // } else {
  //   clicksWidth = hasClicks
  //     ? (safeCount / maxCount) * PRIMARY_MAX
  //     : 0;

  //   clicksLeft = 0;

  //   revenueLeft = clicksWidth;

  //   revenueWidth = hasRevenue
  //     ? (safeRevenue / maxRevenue) * SECONDARY_MAX
  //     : 0;
  // }

  // const PRIMARY_MAX = 50;
  // const SECONDARY_MAX = 50;
  // const FULL_WIDTH = 100;

  // const hasClicks = safeCount > 0 && maxCount > 0;
  // const hasRevenue = safeRevenue > 0 && maxRevenue > 0;

  // let clicksWidth = 0;
  // let revenueWidth = 0;

  // let clicksLeft = 0;
  // let revenueLeft = 0;

  // if (hasClicks && !hasRevenue) {
  //   // Only clicks data exists — give it the full track
  //   clicksWidth = (safeCount / maxCount) * FULL_WIDTH;
  //   clicksLeft = 0;
  // } else {
  //   // Revenue (or both) present — keep the 50/50 split, active metric first
  //   if (isRevenueActive) {
  //     revenueWidth = hasRevenue
  //       ? (safeRevenue / maxRevenue) * PRIMARY_MAX
  //       : 0;
  //     revenueLeft = 0;

  //     clicksLeft = revenueWidth;
  //     clicksWidth = hasClicks
  //       ? (safeCount / maxCount) * SECONDARY_MAX
  //       : 0;
  //   } else {
  //     clicksWidth = hasClicks
  //       ? (safeCount / maxCount) * PRIMARY_MAX
  //       : 0;
  //     clicksLeft = 0;

  //     revenueLeft = clicksWidth;
  //     revenueWidth = hasRevenue
  //       ? (safeRevenue / maxRevenue) * SECONDARY_MAX
  //       : 0;
  //   }
  // }

  const PRIMARY_MAX = 50;
  const SECONDARY_MAX = 50;
  const FULL_WIDTH = 100;

  const hasClicks = safeCount > 0 && maxCount > 0;
  const hasRevenue = safeRevenue > 0 && maxRevenue > 0;

  let clicksWidth = 0;
  let revenueWidth = 0;

  let clicksLeft = 0;
  let revenueLeft = 0;

  if (!kpiConfigured) {
    // No revenue provider AND no valid goal KPI set up for this workspace —
    // there's no second metric to share space with, so clicks always gets the full track.
    clicksWidth = hasClicks ? (safeCount / maxCount) * FULL_WIDTH : 0;
    clicksLeft = 0;
  } else {
    // KPI (revenue or goal) is configured for the workspace — keep the 50/50 split,
    // active metric first. Note: this now applies even if THIS row's revenue happens
    // to be 0, since the workspace-level metric is what determines layout, not the row.
    if (isRevenueActive) {
      revenueWidth = hasRevenue
        ? (safeRevenue / maxRevenue) * PRIMARY_MAX
        : 0;
      revenueLeft = 0;

      clicksLeft = revenueWidth;
      clicksWidth = hasClicks
        ? (safeCount / maxCount) * SECONDARY_MAX
        : 0;
    } else {
      clicksWidth = hasClicks
        ? (safeCount / maxCount) * PRIMARY_MAX
        : 0;
      clicksLeft = 0;

      revenueLeft = clicksWidth;
      revenueWidth = hasRevenue
        ? (safeRevenue / maxRevenue) * SECONDARY_MAX
        : 0;
    }
  }

  const showTooltip = isRowHovered && tooltipPos !== null;

  return (
    <div
      ref={rowRef}
      onClick={() => {
        if (onRowClick) {
          onRowClick();
        } else if (href) {
          router.push(href);
          setShowModal(false);
        }
      }}
      onMouseEnter={handleRowMouseEnter}
      onMouseLeave={handleRowMouseLeave}
      className={cn(
        "group relative block min-w-0 p-0 border-l-0 border-transparent py-0.5 sm:py-1 transition-all",

      )}
    >
      <div
        className={cn(
          "relative flex min-w-0 items-center justify-between",
          isModalView && "gap-4 sm:gap-16"
        )}
      >
        {/* Two independently-scaled bars stacked vertically, split evenly across the row height */}
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-sm">
          {clicksWidth > 0 && (
            <motion.div
              className={cn(
                "absolute top-0 h-full",
                clicksBar.colorClass
              )}
              initial={{ width: 0 }}
              animate={{
                left: `${clicksLeft}%`,
                width: `${clicksWidth}%`,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          )}

          {revenueWidth > 0 && (
            <motion.div
              className={cn(
                "absolute top-0 h-full",
                revenueBar.colorClass
              )}
              initial={{ width: 0 }}
              animate={{
                left: `${revenueLeft}%`,
                width: `${revenueWidth}%`,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          )}
        </div>
        <div
          className={cn(
            "relative z-10 flex h-7 sm:h-8 w-full min-w-0 items-center   px-2 sm:px-4 font-display",
            "max-w-[calc(100%-2rem)] transition-[max-width] duration-300 ease-in-out",
            "group-hover:max-w-[calc(100%-5rem)]"
          )}
        >
          <div className="min-w-0 flex-1">{lineItem}</div>
          {/* {onExpandRow && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onExpandRow();
              }}
              aria-label={`Expand ${title}`}
              className={cn(
                "mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                "opacity-0 -translate-x-1 pointer-events-none",
                "transition-all duration-200 ease-out",
                "group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100",
                "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )} */}
        </div>

        <div className="z-10 flex shrink-0 items-center gap-2 px-2 sm:px-3">
          {/* <NumberFlow
            value={
              unit === "sales" && saleUnit === "saleAmount"
                ? activeValue / 100
                : activeValue
            }
            className={cn(
              "z-10 px-1 sm:px-2 text-xs sm:text-sm font-alexandria text-neutral-600 transition-transform duration-300",
              isModalView ? "-translate-x-14" : "group-hover:-translate-x-14"
            )}
            style={{ transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)` }}
            locales={locale}
            format={
              (unit === "sales" && saleUnit === "saleAmount") || isRevenueActive
                ? {
                  style: "currency",
                  currency: currency ?? "USD",
                  currencyDisplay: "symbol",
                }
                : { notation: activeValue > 999999 ? "compact" : "standard" }
            }
          /> */}
          <NumberFlow
            value={
              unit === "sales" && saleUnit === "saleAmount"
                ? activeValue / 100
                : activeValue
            }
            className={cn(
              "z-10 px-1 sm:px-2 text-xs sm:text-sm font-alexandria text-content-default transition-transform duration-300",
              isModalView ? "-translate-x-14" : "group-hover:-translate-x-14"
            )}
            style={{ transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)` }}
            locales={locale}
            format={
              (unit === "sales" && saleUnit === "saleAmount") ||
                (isRevenueActive && !isGoalKpi)
                ? {
                  style: "currency",
                  currency: currency ?? "USD",
                  currencyDisplay: "symbol",
                }
                : { notation: activeValue > 999999 ? "compact" : "standard" }
            }
          />
          <div
            className={cn(
              "absolute right-0 font-alexandria px-2 sm:px-3 text-xs sm:text-sm text-content-subtle transition-all duration-300",
              isModalView
                ? "visible translate-x-0 opacity-100"
                : "invisible translate-x-14 opacity-0 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100"
            )}
            style={{ transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)` }}
          >
            {percentage > 0 ? `${percentage}%` : "0%"}
          </div>
        </div>
      </div>

      {/* Hover tooltip: pinned to the row (computed once on enter), not tracking the cursor.
          Color swatches match the bar colors 1:1 so it doubles as a legend. */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: tooltipPos!.top,
              left: tooltipPos!.left,
              transform:
                tooltipPos!.placement === "above"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
              transformOrigin:
                tooltipPos!.placement === "above" ? "bottom center" : "top center",
              pointerEvents: "none",
              width: tooltipPos!.width,
            }}
            className="z-50 rounded-xl font-alexandria bg-bg-default p-3 text-content-subtle shadow-xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2">
              {icon && <div className="flex size-[18px] shrink-0 items-center justify-center">{icon}</div>}
              <span className="truncate text-[13px] font-medium text-content-subtle">{title}</span>
            </div>

            <div className="mt-2 space-y-1.5">
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center font-alexandria justify-between text-[13.5px]">
                  <span className="flex items-center gap-1.5 text-content-subtle">
                    <span
                      className={cn("size-3 shrink-0 rounded-full", clicksBar.colorClass)}
                      aria-hidden="true"
                    />
                    {countLabel}
                  </span>
                  <span className="font-medium">{formatNumber(safeCount)}</span>
                </div>
                {kpiConfigured && (
                  <div className="flex items-center font-alexandria justify-between text-[13.5px]">
                    <span className="flex items-center gap-1.5 text-content-subtle">
                      <span
                        className={cn("size-3 shrink-0 rounded-full", revenueBar.colorClass)}
                        aria-hidden="true"
                      />
                      {kpiLabel}
                    </span>
                    <span className="font-medium">{formatKpiValue(safeRevenue)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1 border-t border-border-subtle pt-2">
              {kpiConfigured && (
                <div className="flex items-center font-alexandria justify-between text-[13.5px] text-neutral-400">
                  <span>{kpiLabel}/{countLabel.toLowerCase().replace(/s$/, "")}</span>
                  <span className="font-medium text-neutral-400">
                    {formatKpiValue(revenuePerVisitor)}
                  </span>
                </div>
              )}
              {typeof conversionRate === "number" && !Number.isNaN(conversionRate) && (
                <div className="flex items-center justify-between text-[13px] text-neutral-400">
                  <span>Conversion rate</span>
                  <span className="font-medium text-neutral-400">
                    {conversionRate.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const VirtualLineItem = memo(
  ({
    data,
    index,
    style,
  }: {
    data: ComponentProps<typeof LineItem>[];
    index: number;
    style: any;
  }) => {
    const props = data[index];

    return (
      <div style={style}>
        <LineItem {...props} />
      </div>
    );
  },
  areEqual
);