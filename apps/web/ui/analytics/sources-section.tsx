"use client";

import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { useRouterStuff } from "@repo/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

type TabId = "referers" | "utm";
type Subtab =
  | "referers"
  | "referer_urls"
  | "utm_sources"
  | "utm_campaigns"
  | "utm_mediums"
  | "utm_terms"
  | "utm_contents";

const TAB_CONFIG: Record<
  TabId,
  {
    subtabs: Subtab[];
    defaultSubtab: Subtab;
    getSubtabLabel: (subtab: Subtab) => string;
  }
> = {
  referers: {
    subtabs: ["referers", "referer_urls"],
    defaultSubtab: "referers",
    getSubtabLabel: (subtab) => (subtab === "referers" ? "Domain" : "URL"),
  },
  utm: {
    subtabs: [
      "utm_sources",
      "utm_campaigns",
      "utm_mediums",
      "utm_terms",
      "utm_contents",
    ],
    defaultSubtab: "utm_sources",
    getSubtabLabel: (subtab) => {
      const labels: Record<string, string> = {
        utm_sources: "Source",
        utm_campaigns: "Campaign",
        utm_mediums: "Medium",
        utm_terms: "Term",
        utm_contents: "Content",
      };
      return labels[subtab] || subtab;
    },
  },
};

export function SourcesSection() {
  const { queryParams, searchParams } = useRouterStuff();

  const { selectedTab, saleUnit } = useContext(AnalyticsContext);
  const dataKey = selectedTab === "revenue" ? "revenue" : "count";

  const [tab, setTab] = useState<TabId>("referers");
  const [subtab, setSubtab] = useState<Subtab>(
    TAB_CONFIG["referers"].defaultSubtab
  );
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Reset subtab when tab changes to ensure it's valid for the new tab
  const handleTabChange = (newTab: TabId) => {
    setTab(newTab);
    setSubtab(TAB_CONFIG[newTab].defaultSubtab);
  };

  const { data } = useAnalyticsFilterOption({
    groupBy: subtab,
  });
  const { data: allData } = useAnalyticsFilterOption(
    { groupBy: subtab },
    { omitGroupByFilterKey: true }
  );

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[subtab];

  useEffect(() => {
    setSelectedItems([]);
  }, [tab, subtab]);

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

  const subTabProps = useMemo(() => {
    const config = TAB_CONFIG[tab];
    return {
      subTabs: config.subtabs.map((s) => ({
        id: s,
        label: config.getSubtabLabel(s),
      })),
      selectedSubTabId: subtab,
      onSelectSubTab: setSubtab,
    };
  }, [tab, subtab]);

  return (
    <AnalyticsCard
      tabs={[
        { id: "referers", label: "Referrers" },
        { id: "utm", label: "UTM Parameters" },
      ]}
      selectedTabId={tab}
      onSelectTab={handleTabChange}
      {...subTabProps}
      expandLimit={8}
      dataLength={data?.length}
      isFilterActive={isFilterActive}
      onClearFilter={onClearFilter}
    >
      {({ limit, setShowModal }) => (
        <>
          {data ? (
            data.length > 0 ? (
              <BarList
                tab={singularTabName}
                data={
                  data
                    ?.map((d) => ({
                      title: d[singularTabName],
                      filterValue: d[singularTabName],
                      value: d[dataKey] || 0,
                    }))
                    ?.sort((a, b) => b.value - a.value) || []
                }
                allData={allData
                  ?.map((d) => ({
                    title: d[singularTabName],
                    filterValue: d[singularTabName],
                    value: d[dataKey] || 0,
                  }))
                  ?.sort((a, b) => b.value - a.value)}
                unit={selectedTab}
                maxValue={Math.max(...data.map((d) => d[dataKey] ?? 0)) ?? 0}
                barBackground="bg-orange-100"
                hoverBackground="hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent hover:border-orange-500"
                filterSelectedBackground="bg-orange-600"
                filterSelectedHoverBackground="hover:bg-orange-700"
                filterHoverClass="bg-white border border-orange-200"
                setShowModal={setShowModal}
                selectedFilterValues={selectedItems}
                activeFilterValues={activeFilterValues}
                onToggleFilter={onToggleFilter}
                onClearFilter={onClearFilter}
                onClearSelection={() => setSelectedItems([])}
                onApplyFilterValues={onApplyFilterValues}
                {...(limit && { limit })}
              />
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm font-medium font-default text-neutral-500">
                  No data available
                </p>
              </div>
            )
          ) : (
            <div className="absolute inset-0 flex h-[300px] w-full items-center justify-center bg-white/50">
              <LoadingSpinner />
            </div>
          )}
        </>
      )}
    </AnalyticsCard>
  );
}
