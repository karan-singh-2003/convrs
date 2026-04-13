"use client";

import { Button, Tooltip, useMediaQuery } from "@repo/ui";
import { cn, getPrettyUrl } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { Search } from "lucide-react";
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
}: {
  tab: string;
  unit: string;
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
  onApplyFilterValues?: (values: string[]) => void;
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

  // Calculate total sum for percentage calculations
  const totalSum = useMemo(
    () => sourceData.reduce((sum, item) => sum + item.value, 0),
    [sourceData]
  );

  // TODO: mock pagination for better perf in React
  const filteredData = useMemo(() => {
    if (limit) {
      return data.slice(0, limit);
    } else {
      return search
        ? sourceData.filter((d) =>
            d.title.toLowerCase().includes(search.toLowerCase())
          )
        : sourceData;
    }
  }, [data, sourceData, limit, search]);

  const { isMobile } = useMediaQuery();

  const virtualize = filteredData.length > 100;

  const itemProps = filteredData.map((data) => ({
    ...data,
    maxValue,
    totalSum,
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
        <div className="relative px-4 py-3">
          <div className="pointer-events-none absolute inset-y-0 left-7 flex items-center">
            <Search className="h-4 w-4 text-neutral-400" />
          </div>
          <input
            type="text"
            autoFocus={!isMobile}
            className="w-full rounded-md border border-neutral-300 py-2 pl-10 text-black placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-4 focus:ring-neutral-200 sm:text-sm"
            placeholder={`Search ${tab}...`}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <div className="h-[50vh] overflow-auto pb-4 md:h-[40vh]">{bars}</div>
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
  unit,
  setShowModal,
  hoverBackground,
  linkData,
  limit,
  isSelected,
  onFilterClick,
  href,
}: {
  icon?: ReactNode;
  title: string;
  value: number;
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
}) {
  const [filterButtonHovered, setFilterButtonHovered] = useState(false);
  const [tooltipResetKey, setTooltipResetKey] = useState(0);
  const { saleUnit } = useContext(AnalyticsContext);
  const router = useRouter();

  const percentage = Math.round((value / totalSum) * 1000) / 10;
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
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-neutral-100"
          >
            {icon}
          </button>
        ) : (
          <div className="flex size-6  shrink-0 items-center justify-center">
            {icon}
          </div>
        )
      ) : (
        <div className="size-0 shrink-0" aria-hidden="true" />
      )}
      {tab === "links" && linkData ? (
        <h1>getPrettyUrl(title)</h1>
      ) : tab === "urls" ? (
        <Tooltip
          key={tooltipResetKey}
          content={`[${title}](${title})`}
          contentClassName="max-w-lg"
          disabled={filterButtonHovered}
        >
          <div className="truncate text-[16px] text-neutral-600">
            {getPrettyUrl(title)}
          </div>
        </Tooltip>
      ) : (
        <div className="truncate text-[15px] text-neutral-600">
          {getPrettyUrl(title)}
        </div>
      )}
    </div>
  );

  const rowClickable = !!onFilterClick || (!!href && !onFilterClick);

  return (
    <div
      onClick={() => {
        if (onFilterClick) {
          onFilterClick();
        } else if (href && !onFilterClick) {
          router.push(href);
          setShowModal(false);
        }
      }}
      className={cn(
        "group block min-w-0 border-l-2  border-transparent py-1 transition-all",
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
          style={{
            width: `${percentage}%`,
            position: "absolute",
            inset: 0,
          }}
          className="-z-10 h-full  origin-left rounded-none px-4 bg-neutral-100"
          transition={{ ease: "easeOut", duration: 0.3 }}
          initial={{ transform: "scaleX(0)" }}
          animate={{ transform: "scaleX(1)" }}
        />
        <div className="relative z-10 flex h-8 px-4 w-full min-w-0 max-w-[calc(100%-2rem)] border-l-4 border-neutral-500 font-display items-center transition-[max-width] duration-300 ease-in-out group-hover:max-w-[calc(100%-5rem)]">
          {lineItem}
        </div>
        <div className="z-10 px-3 flex items-center">
          <NumberFlow
            value={
              unit === "sales" && saleUnit === "saleAmount"
                ? value / 100
                : value
            }
            className={cn(
              "z-10 px-2 text-sm font-display text-neutral-600 transition-transform duration-300",
              isModalView ? "-translate-x-14" : "group-hover:-translate-x-14"
            )}
            style={{
              // Adds translateZ(0) to fix transition jitter
              transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)`,
            }}
            format={
              unit === "sales" && saleUnit === "saleAmount"
                ? {
                    style: "currency",
                    currency: "USD",
                  }
                : {
                    notation: value > 999999 ? "compact" : "standard",
                  }
            }
          />
          <div
            className={cn(
              "absolute right-0 font-display px-3 text-sm text-neutral-600/70 transition-all duration-300",
              isModalView
                ? "visible translate-x-0 opacity-100"
                : "invisible translate-x-14 opacity-0 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100"
            )}
            style={{
              // Adds translateZ(0) to fix transition jitter
              transform: `translateX(var(--tw-translate-x, 0)) translateZ(0)`,
            }}
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
