"use client";

import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { useRouterStuff } from "@repo/ui";
import { CONTINENTS, COUNTRIES, REGIONS } from "@repo/utils";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function LocationSection() {
  const { queryParams, searchParams } = useRouterStuff();

  const { selectedTab } = useContext(AnalyticsContext);
  const dataKey = selectedTab === "revenue" ? "revenue" : "count";

  const [tab, setTab] = useState<
    "countries" | "cities" | "regions" | "continents"
  >("countries");

  const { data } = useAnalyticsFilterOption(tab);
  const { data: allData } = useAnalyticsFilterOption(tab, {
    omitGroupByFilterKey: true,
  });

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[tab];
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    setSelectedItems([]);
  }, [tab]);

  const onToggleFilter = useCallback((val: string) => {
    setSelectedItems((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }, []);

  useEffect(() => {
    console.log("selectedItems", selectedItems);
  }, [selectedItems]);

  const onApplyFilterValues = useCallback(
    (values: string[]) => {
      if (values.length === 0) {
        queryParams({ del: singularTabName });
      } else {
        queryParams({ set: { [singularTabName]: values.join(",") } });
      }
      setSelectedItems([]);
    },
    [singularTabName, queryParams]
  );

  const isFilterActive = searchParams.has(singularTabName);
  const activeFilterValues = useMemo(
    () => searchParams.get(singularTabName)?.split(",") ?? [],
    [singularTabName, searchParams]
  );

  const onClearFilter = useCallback(() => {
    setSelectedItems([]);
    if (isFilterActive) queryParams({ del: singularTabName });
  }, [singularTabName, queryParams, isFilterActive]);

  //  Filter out "Unknown"
  const isValidLocation = (d: any) => {
    switch (tab) {
      case "countries":
        return d.country && d.country !== "Unknown";
      case "cities":
        return d.city && d.city !== "Unknown";
      case "regions":
        return d.region && !d.region.endsWith("-Unknown");
      case "continents":
        return d.continent && d.continent !== "Unknown";
      default:
        return true;
    }
  };

  //  Safe mapping
  const mapData = (arr: any[]) =>
    arr
      ?.filter(isValidLocation)
      ?.map((d) => ({
        icon:
          tab === "continents" ? (
            <h1 className="size-3 sm:size-4 flex items-center justify-center rounded-full border border-cyan-500 text-xs font-semibold text-cyan-700">
              {CONTINENTS[d.continent]?.[0] || "🌍"}
            </h1>
          ) : (
            <img
              alt={d.country}
              src={`https://hatscripts.github.io/circle-flags/flags/${d.country.toLowerCase()}.svg`}
              className="size-3 sm:size-4 shrink-0"
            />
          ),

        title:
          tab === "continents"
            ? CONTINENTS[d.continent]
            : tab === "countries"
              ? COUNTRIES[d.country]
              : `${tab === "cities" ? `${d.city}, ` : ""}${REGIONS[d.region] || d.region?.split("-")[1]
              }`,

        filterValue: d[singularTabName],
        value: d[dataKey] || 0,
      }))
      ?.sort((a, b) => b.value - a.value) || [];

  return (
    <AnalyticsCard
      tabs={[
        { id: "countries", label: "Countries" },
        { id: "cities", label: "Cities" },
        { id: "regions", label: "Regions" },
        // { id: "continents", label: "Continents" },
      ]}
      selectedTabId={tab}
      onSelectTab={setTab}
      expandLimit={8}
      dataLength={data?.length}
      isFilterActive={isFilterActive}
      onClearFilter={onClearFilter}
    >
      {({ limit, setShowModal }) =>
        data ? (
          mapData(data).length > 0 ? (
            <BarList
              placeholder={`${tab}`}
              tab={singularTabName}
              data={mapData(data)}
              allData={mapData(allData || [])}
              unit={selectedTab}
              maxValue={
                Math.max(...mapData(data).map((d) => d.value ?? 0)) || 0
              }
              barBackground="bg-blue-100"
              hoverBackground="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent hover:border-blue-500"
              filterSelectedBackground="bg-blue-600"
              filterSelectedHoverBackground="hover:bg-blue-700"
              filterHoverClass="bg-white border border-blue-200"
              setShowModal={setShowModal}
              selectedFilterValues={selectedItems}
              activeFilterValues={activeFilterValues}
              onToggleFilter={onToggleFilter}
              onClearFilter={onClearFilter}
              onClearSelection={() => setSelectedItems([])}
              onApplyFilterValues={onApplyFilterValues}
              onRowFilterItem={(val) => onApplyFilterValues([val])}
              {...(limit && { limit })}
            />
          ) : (
            <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
              <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
                No data available
              </p>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex h-[250px] w-full items-center justify-center bg-white/50 sm:h-[300px]">
            <LoadingSpinner />
          </div>
        )
      }
    </AnalyticsCard>
  );
}
