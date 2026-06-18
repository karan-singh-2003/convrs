"use client";

import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { DeviceTabs } from "@/lib/analytics/types";
import { useRouterStuff } from "@repo/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { DeviceIcon } from "./device-icon";
import { TRIGGER_DISPLAY } from "./trigger-display";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function DeviceSection() {
  const { queryParams, searchParams } = useRouterStuff();

  const { selectedTab, saleUnit } = useContext(AnalyticsContext);
  const dataKey = selectedTab === "revenue" ? "revenue" : "count";

  const [tab, setTab] = useState<DeviceTabs>("devices");
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

  return (
    <AnalyticsCard
      tabs={[
        { id: "devices", label: "Devices" },
        { id: "browsers", label: "Browsers" },
        { id: "os", label: "OS" },
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
          data.length > 0 ? (
            <BarList
              tab={singularTabName}
              data={
                data
                  ?.map((d) => ({
                    icon: (
                      <DeviceIcon
                        display={d[singularTabName]}
                        tab={tab}
                        className="h-3 w-3 sm:h-4 sm:w-4"
                      />
                    ),
                    title:
                      tab === "triggers"
                        ? TRIGGER_DISPLAY[d.trigger].title
                        : d[singularTabName],
                    filterValue: d[singularTabName],
                    value: d[dataKey] || 0,
                  }))
                  ?.sort((a, b) => b.value - a.value) || []
              }
              allData={allData
                ?.map((d) => ({
                  icon: (
                    <DeviceIcon
                      display={d[singularTabName]}
                      tab={tab}
                      className="h-3 w-3 sm:h-4 sm:w-4"
                    />
                  ),
                  title:
                    tab === "triggers"
                      ? TRIGGER_DISPLAY[d.trigger].title
                      : d[singularTabName],
                  filterValue: d[singularTabName],
                  value: d[dataKey] || 0,
                }))
                ?.sort((a, b) => b.value - a.value)}
              unit={selectedTab}
              maxValue={Math.max(...data.map((d) => d[dataKey] ?? 0)) ?? 0}
              barBackground="bg-green-100"
              hoverBackground="hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent hover:border-green-500"
              filterSelectedBackground="bg-green-600"
              filterSelectedHoverBackground="hover:bg-green-700"
              filterHoverClass="bg-white border border-green-200"
              setShowModal={setShowModal}
              selectedFilterValues={selectedItems}
              activeFilterValues={activeFilterValues}
              onToggleFilter={onToggleFilter}
              onClearFilter={onClearFilter}
              onClearSelection={() => setSelectedItems([])}
              onRowFilterItem={(val) => onApplyFilterValues([val])}
              onApplyFilterValues={onApplyFilterValues}
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
