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
  useState,
} from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { areEqual, FixedSizeList } from "react-window";
import { AnalyticsContext } from "./analytics-providers";

export function BarList({
  tab,
  unit,
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
  onExpandRow
}: {
  placeholder?: string;
  tab: string;
  unit: string;
  totalVisitors?: number
  data: {
    icon?: ReactNode;
    title: string;
    filterValue?: string;
    value: number;
    linkId?: string;
    /** When set without filter UI (e.g. billing usage modal), row navigates here */
    href?: string;
  }[];
  allData?: {
    icon?: ReactNode;
    title: string;
    filterValue?: string;
    value: number;
    linkId?: string;
    href?: string;
  }[];
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

  // Collapsed card: selection UI is staging-only (new picks before Apply).
  const effectiveSelectedValues = !limit
    ? modalSelectedValues
    : selectedFilterValues;

  const sourceData = !limit && allData ? allData : data;

  const totalSum = useMemo(
    () => sourceData.reduce((sum, item) => sum + item.value, 0),
    [sourceData]
  );
  const [inputValue, setInputValue] = useState("");

  // TODO: mock pagination for better perf in React
  const filteredData = useMemo(() => {
    if (limit) {
      return data.slice(0, limit);
    }

    const searchLower = search.toLowerCase();

    return search
      ? sourceData.filter((d) =>
        (d.title ?? d.filterValue ?? "").toLowerCase().includes(searchLower)
      )
      : sourceData;
  }, [data, sourceData, limit, search]);

  const { isMobile } = useMediaQuery();

  const virtualize = filteredData.length > 100;

  const itemProps = filteredData.map((data) => ({
    ...data,
    maxValue,
    totalSum,
    totalVisitors,
    tab,
    unit,
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
  }));

  // Removed filterButtons: No Filter/Clear buttons when clicking a bar

  const bars = (
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
            <LineItem key={idx} {...itemProps[idx]} />
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
        <div className="px-2 py-2 border-b border-neutral-200 sm:px-4 sm:py-3">
          <div className="flex overflow-hidden focus:border-1 border-neutral-200 rounded-full w-full bg-neutral-100">
            <input
              type="text"
              placeholder={`Search ${placeholder}`}
              autoFocus={!isMobile}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setSearch(inputValue); } }}
              className="w-full border-0 focus:border-0 bg-neutral-100 rounded-full font-default border-neutral-300 py-2 md:py-2.5 text-sm text-black placeholder:text-neutral-400 px-5 focus:border-neutral-500 focus:outline-none focus:ring-0 sm:text-[15px]"
            />
            <button
              type="button"
              onClick={() => setSearch(inputValue)}
              className="flex items-center justify-center pr-4 pl-3 bg-neutral-700 text-white hover:bg-neutral-700 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative my-2  ">
          <div className="h-[45vh] overflow-auto scrollbar pb-3 sm:pb-4 sm:h-[50vh] md:h-[40vh]">
            {bars}
          </div>
        </div>
      </>
    );
  }
}

export function LineItem({
  icon,
  title,
  value,
  totalSum,
  tab,
  totalVisitors,
  unit,
  setShowModal,
  hoverBackground,
  linkData,
  limit,
  isSelected,
  onRowClick,
  onFilterClick,
  href,
  onExpandRow
}: {
  icon?: ReactNode;
  title: string;
  value: number;
  totalVisitors?: number
  totalSum: number;
  tab: string;
  unit: string;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  hoverBackground: string;
  linkData?: any;
  limit?: number;
  isSelected?: boolean;
  onFilterClick?: () => void;
  href?: string;
  onRowClick?: () => void;
  onExpandRow?: () => void;  // ← add
}) {
  const [filterButtonHovered, setFilterButtonHovered] = useState(false);
  const [tooltipResetKey, setTooltipResetKey] = useState(0);
  const { saleUnit } = useContext(AnalyticsContext);
  const router = useRouter();

  const percentage =
    tab === "goal"
      ? Math.round((value / (totalVisitors || 1)) * 1000) / 10
      : Math.round((value / totalSum) * 1000) / 10;


  const isModalView = !limit;

  const lineItem = (
    <div className="z-10 flex items-center space-x-2  overflow-hidden ">
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
            className="flex size-5 sm:size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-neutral-100"
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
        <h1>{getPrettyUrl(title)}</h1>
      ) : tab === "urls" ? (
        <Tooltip
          key={tooltipResetKey}
          content={`[${title}](${title})`}
          contentClassName="max-w-lg"
          disabled={filterButtonHovered}
        >
          <div className="truncate text-[13px] text-neutral-600 sm:text-[16px]">
            {getPrettyUrl(title)}
          </div>
        </Tooltip>
      ) : (
        <div className="truncate text-[13px] text-neutral-600 sm:text-[15px]">
          {title}
        </div>
      )}
    </div>
  );

  const rowClickable = !!onFilterClick || (!!href && !onFilterClick);

  return (
    <div
      // onClick={() => {
      //   if (onFilterClick) {
      //     // this shoudl filter 
      //     onFilterClick();
      //   } else if (href && !onFilterClick) {
      //     router.push(href);
      //     setShowModal(false);
      //   }
      // }}
      onClick={() => {
        if (onRowClick) {
          onRowClick();
        } else if (href) {
          router.push(href);
          setShowModal(false);
        }
      }}
      className={cn(
        "group block min-w-0 p-0 border-l-0 border-transparent py-0.5 sm:py-1 transition-all",
        rowClickable && "cursor-pointer"
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-between",
          isModalView && "gap-16"
        )}
      >
        <motion.div
          style={{ width: `${percentage}%`, position: "absolute", inset: 0 }}
          className="-z-10 h-full origin-left rounded-none px-2 sm:px-4 bg-neutral-100"
          transition={{ ease: "easeOut", duration: 0.3 }}
          initial={{ transform: "scaleX(0)" }}
          animate={{ transform: "scaleX(1)" }}
        />

        <div
          className={cn(
            "relative z-10 flex h-7 sm:h-8 w-full min-w-0 items-center border-l-4 border-neutral-500 px-2 sm:px-4 font-display",
            "max-w-[calc(100%-2rem)] transition-[max-width] duration-300 ease-in-out",
            "group-hover:max-w-[calc(100%-5rem)]"
          )}
        >

          <div className="min-w-0 flex-1">
            {lineItem}
          </div>
          {onExpandRow && (
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
          )}

        </div>

        <div className="z-10 px-2 sm:px-3 flex items-center">
          <NumberFlow
            value={
              unit === "sales" && saleUnit === "saleAmount" ? value / 100 : value
            }
            className={cn(
              "z-10 px-1 sm:px-2 text-xs sm:text-sm font-display text-neutral-600 transition-transform duration-300",
              isModalView ? "-translate-x-14" : "group-hover:-translate-x-14"
            )}
            style={{ transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)` }}
            locales="en-US"
            format={
              (unit === "sales" && saleUnit === "saleAmount") || unit === "revenue"
                ? { style: "currency", currency: "USD", currencyDisplay: "symbol" }
                : { notation: value > 999999 ? "compact" : "standard" }
            }
          />
          <div
            className={cn(
              "absolute right-0 font-display px-2 sm:px-3 text-xs sm:text-sm text-neutral-600/70 transition-all duration-300",
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
