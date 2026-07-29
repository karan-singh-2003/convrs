// "use client";

// import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
// import { useRouterStuff } from "@repo/ui";
// import { useCallback, useContext, useEffect, useMemo, useState } from "react";
// import { AnalyticsCard } from "./analytics-card";
// import { LoadingSpinner } from "@repo/ui";
// import { AnalyticsContext } from "./analytics-providers";
// import { BarList } from "./bar-list";
// import { useAnalyticsFilterOption } from "./use-analytics-filter-option";
// import useWorkspace from "@/lib/swr/use-workspace";
// import useIntegrations from "@/lib/swr/use-integration";

// type TabId =  "referers" | "utm";
// type Subtab =
//   | "referers"
//   | "referer_urls"
//   | "utm_sources"
//   | "utm_campaigns"
//   | "utm_mediums"
//   | "utm_terms"
//   | "utm_contents";

// const TAB_CONFIG: Record<
//   TabId,
//   {
//     subtabs: Subtab[];
//     defaultSubtab: Subtab;
//     getSubtabLabel: (subtab: Subtab) => string;
//   }
// > = {
//   referers: {
//     subtabs: ["referers", "referer_urls"],
//     defaultSubtab: "referers",
//     getSubtabLabel: (subtab) => (subtab === "referers" ? "Domain" : "URL"),
//   },
//   utm: {
//     subtabs: [
//       "utm_sources",
//       "utm_campaigns",
//       "utm_mediums",
//       "utm_terms",
//       "utm_contents",
//     ],
//     defaultSubtab: "utm_sources",
//     getSubtabLabel: (subtab) => {
//       const labels: Record<string, string> = {
//         utm_sources: "Source",
//         utm_campaigns: "Campaign",
//         utm_mediums: "Medium",
//         utm_terms: "Term",
//         utm_contents: "Content",
//       };
//       return labels[subtab] || subtab;
//     },
//   },
// };

// export function SourcesSection() {
//   const { queryParams, searchParams } = useRouterStuff();

//   const { selectedTab, saleUnit, currency } = useContext(AnalyticsContext);
//   const dataKey = selectedTab === "revenue" ? "revenue" : "count";
//   const { kpiEventName, kpiType } = useWorkspace()
//   const { integrations } = useIntegrations()
//   const [tab, setTab] = useState<TabId>("referers");
//   const [subtab, setSubtab] = useState<Subtab>(
//     TAB_CONFIG["referers"].defaultSubtab
//   );
//   const [selectedItems, setSelectedItems] = useState<string[]>([]);

//   // Reset subtab when tab changes to ensure it's valid for the new tab
//   const handleTabChange = (newTab: TabId) => {
//     setTab(newTab);
//     setSubtab(TAB_CONFIG[newTab].defaultSubtab);
//   };
//   const isGoalKpi = kpiType === "goal" && !!kpiEventName;
//   const isRevenueKpi =
//     kpiType === "revenue" && integrations.length > 0;

//   const kpiLabel = isGoalKpi ? kpiEventName! : "Revenue";
//   const { data } = useAnalyticsFilterOption({
//     groupBy: subtab,
//   });
//   const { data: allData } = useAnalyticsFilterOption(
//     { groupBy: subtab },
//     { omitGroupByFilterKey: true }
//   );

//   const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[subtab];

//   useEffect(() => {
//     setSelectedItems([]);
//   }, [tab, subtab]);

//   const onToggleFilter = useCallback((val: string) => {
//     setSelectedItems((prev) =>
//       prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
//     );
//   }, []);

//   const onApplyFilterValues = useCallback(
//     (values: string[]) => {
//       if (values.length === 0) {
//         queryParams({ del: singularTabName });
//       } else {
//         queryParams({ set: { [singularTabName]: values.join(",") } });
//       }
//       setSelectedItems([]);
//     },
//     [singularTabName, queryParams]
//   );

//   const isFilterActive = searchParams.has(singularTabName);
//   const activeFilterValues = useMemo(
//     () => searchParams.get(singularTabName)?.split(",") ?? [],
//     [singularTabName, searchParams]
//   );

//   const onClearFilter = useCallback(() => {
//     setSelectedItems([]);
//     if (isFilterActive) queryParams({ del: singularTabName });
//   }, [singularTabName, queryParams, isFilterActive]);

//   const subTabProps = useMemo(() => {
//     const config = TAB_CONFIG[tab];
//     return {
//       subTabs: config.subtabs.map((s) => ({
//         id: s,
//         label: config.getSubtabLabel(s),
//       })),
//       selectedSubTabId: subtab,
//       onSelectSubTab: setSubtab,
//     };
//   }, [tab, subtab]);
//   const kpiConfigured = isRevenueKpi || isGoalKpi;


//   return (
//     <AnalyticsCard
//       tabs={[
//         { id: "referers", label: "Referrers" },
//         { id: "utm", label: "UTM Parameters" },
//       ]}
//       selectedTabId={tab}
//       onSelectTab={handleTabChange}
//       {...subTabProps}
//       expandLimit={8}
//       dataLength={data?.length}
//       isFilterActive={isFilterActive}
//       onClearFilter={onClearFilter}
//     >
//       {({ limit, setShowModal, metric }) => (
//         <>
//           {data ? (
//             data.length > 0 ? (
//               <BarList
//                 tab={singularTabName}
//                 data={data?.map((d) => ({
//                   title: subtab === "referers" ? getReferrerDisplayName(d[singularTabName]) : d[singularTabName],
//                   filterValue: d[singularTabName],
//                   count: d.count || 0,
//                   revenue: d.revenue || 0,
//                 })) || []}
//                 allData={allData?.map((d) => ({
//                   title: d[singularTabName],
//                   filterValue: d[singularTabName],
//                   count: d.count || 0,
//                   revenue: d.revenue || 0,
//                 }))}
//                 unit={selectedTab}
//                 metric={metric}
//                 maxValue={Math.max(...data.map((d) => (metric === "revenue" ? d.revenue : d.count) ?? 0)) || 0}
//                 barBackground="bg-orange-100"
//                 hoverBackground="hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent hover:border-orange-500"
//                 filterSelectedBackground="bg-orange-600"
//                 filterSelectedHoverBackground="hover:bg-orange-700"
//                 filterHoverClass="bg-white border border-orange-200"
//                 setShowModal={setShowModal}
//                 selectedFilterValues={selectedItems}
//                 activeFilterValues={activeFilterValues}
//                 onToggleFilter={onToggleFilter}
//                 onClearFilter={onClearFilter}
//                 onClearSelection={() => setSelectedItems([])}
//                 onRowFilterItem={(val) => onApplyFilterValues([val])}
//                 onApplyFilterValues={onApplyFilterValues}
//                 {...(limit && { limit })}
//                 currency={currency}
//                 kpiLabel={kpiLabel}      // NEW
//                 isGoalKpi={isGoalKpi}
//                 kpiConfigured={kpiConfigured}
//               />
//             ) : (
//               <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
//                 <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
//                   No data available
//                 </p>
//               </div>
//             )
//           ) : (
//             <div className="absolute inset-0 flex h-[250px] w-full items-center justify-center  sm:h-[300px]">
//               <LoadingSpinner />
//             </div>
//           )}
//         </>
//       )}
//     </AnalyticsCard>
//   );
// }


// const REFERRER_MAP: Record<string, string> = {
//   "t.co": "X",
//   "x.com": "X",
//   "twitter.com": "X",

//   "google.com": "Google",
//   "bing.com": "Bing",
//   "duckduckgo.com": "DuckDuckGo",

//   "facebook.com": "Facebook",
//   "m.facebook.com": "Facebook",
//   "l.facebook.com": "Facebook",

//   "instagram.com": "Instagram",

//   "linkedin.com": "LinkedIn",
//   "lnkd.in": "LinkedIn",

//   "reddit.com": "Reddit",

//   "news.ycombinator.com": "Hacker News",

//   "github.com": "GitHub",
// };

// export function getReferrerDisplayName(referrer?: string | null) {
//   if (!referrer) return "(direct)";
//   return REFERRER_MAP[referrer] ?? referrer;
// }


"use client";

import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { useRouterStuff } from "@repo/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { ChannelBreakdown } from "./channel-breakdown";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";
import useWorkspace from "@/lib/swr/use-workspace";
import useIntegrations from "@/lib/swr/use-integration";
import { getReferrerDisplayName } from "@/lib/analytics/channels";
import {
  groupReferrersByDisplayName,
  ReferrerRow,
} from "@/lib/swr/use-channel-breakdown";

type TabId = "channel" | "referers" | "utm";
type Subtab =
  | "referers"
  | "referer_urls"
  | "utm_sources"
  | "utm_campaigns"
  | "utm_mediums"
  | "utm_terms"
  | "utm_contents";

// "channel" has no subtabs — it renders ChannelBreakdown directly.
// "channel" has no subtabs — it renders ChannelBreakdown directly.
const TAB_CONFIG: Partial<
  Record<
    TabId,
    {
      subtabs: Subtab[];
      defaultSubtab: Subtab;
      getSubtabLabel: (subtab: Subtab) => string;
    }
  >
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

  const { selectedTab, currency } = useContext(AnalyticsContext);
  const { kpiEventName, kpiType } = useWorkspace();
  const { integrations } = useIntegrations();

  const [tab, setTab] = useState<TabId>("channel");
  const [subtab, setSubtab] = useState<Subtab>(
    TAB_CONFIG["referers"]!.defaultSubtab
  );
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  // Only meaningful on tab="referers" / subtab="referers" — the display-name
  // (e.g. "X") the user drilled into to see its raw underlying domains.
  const [drilledDisplayName, setDrilledDisplayName] = useState<string | null>(
    null
  );

  const isChannelTab = tab === "channel";
  const isGroupedReferersView =
    tab === "referers" && subtab === "referers" && !drilledDisplayName;
  const isDrilledReferersView =
    tab === "referers" && subtab === "referers" && !!drilledDisplayName;

  const handleTabChange = (newTab: TabId) => {
    setTab(newTab);
    const config = TAB_CONFIG[newTab];
    if (config) setSubtab(config.defaultSubtab);
  };

  const isGoalKpi = kpiType === "goal" && !!kpiEventName;
  const isRevenueKpi = kpiType === "revenue" && integrations.length > 0;
  const kpiLabel = isGoalKpi ? kpiEventName! : "Revenue";
  const kpiConfigured = isRevenueKpi || isGoalKpi;

  // ChannelBreakdown fetches its own referrer data internally — skip here.
  const { data } = useAnalyticsFilterOption({ groupBy: subtab });
  const { data: allData } = useAnalyticsFilterOption(
    { groupBy: subtab },
    { omitGroupByFilterKey: true }
  );

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[subtab];

  useEffect(() => {
    setSelectedItems([]);
    setDrilledDisplayName(null);
  }, [tab, subtab]);

  // Raw per-domain rows for the "referers" subtab, used both for the
  // grouped top-level view and the drilled-in raw-domain view.
  const referrerRows: ReferrerRow[] = useMemo(
    () =>
      (subtab === "referers" ? data ?? [] : []).map((d) => ({
        referer: d[singularTabName],
        count: d.count ?? 0,
        revenue: d.revenue ?? 0,
        conversions: d.conversions ?? 0,
      })),
    [data, subtab, singularTabName]
  );

  // Top-level: grouped by display name ("X" combines t.co/x.com/twitter.com)
  const groupedReferrers = useMemo(
    () => groupReferrersByDisplayName(referrerRows),
    [referrerRows]
  );

  // Drilled-in: raw domains belonging to the selected display name.
  // NOTE: do not re-run groupMembersByDisplayName here — every row in the
  // filtered subset already shares the same display name, so regrouping
  // would collapse them back into a single bar instead of breaking them
  // out by raw domain.
  const drilledMembers = useMemo(() => {
    if (!drilledDisplayName) return null;
    return referrerRows
      .filter((r) => getReferrerDisplayName(r.referer) === drilledDisplayName)
      .map((r) => ({
        title: r.referer,
        filterValue: r.referer,
        count: r.count,
        revenue: r.revenue,
      }))
      .sort((a, b) => b.count - a.count);
  }, [drilledDisplayName, referrerRows]);

  const onToggleFilter = useCallback((val: string) => {
    setSelectedItems((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }, []);

  // In the grouped top-level referers view, `values` are display-name labels
  // (e.g. "X") — expand each into its underlying raw domains before setting
  // the query param, since filtering happens on raw referer values. Every
  // other view already deals in raw values, so it passes through unchanged.
  const onApplyFilterValues = useCallback(
    (values: string[]) => {
      const expanded = isGroupedReferersView
        ? values.flatMap((label) =>
          referrerRows
            .filter((r) => getReferrerDisplayName(r.referer) === label)
            .map((r) => r.referer)
        )
        : values;

      if (expanded.length === 0) {
        queryParams({ del: singularTabName });
      } else {
        queryParams({ set: { [singularTabName]: expanded.join(",") } });
      }
      setSelectedItems([]);
    },
    [singularTabName, queryParams, isGroupedReferersView, referrerRows]
  );

  const isFilterActive = !isChannelTab && searchParams.has(singularTabName);
  const activeFilterValues = useMemo(
    () => searchParams.get(singularTabName)?.split(",") ?? [],
    [singularTabName, searchParams]
  );

  const onClearFilter = useCallback(() => {
    setSelectedItems([]);
    if (!isChannelTab && isFilterActive) queryParams({ del: singularTabName });
  }, [singularTabName, queryParams, isFilterActive, isChannelTab]);

  const subTabProps = useMemo(() => {
    const config = TAB_CONFIG[tab];
    if (!config) {
      return { subTabs: [], selectedSubTabId: subtab, onSelectSubTab: setSubtab };
    }
    return {
      subTabs: config.subtabs.map((s) => ({
        id: s,
        label: config.getSubtabLabel(s),
      })),
      selectedSubTabId: subtab,
      onSelectSubTab: setSubtab,
    };
  }, [tab, subtab]);

  const displayDataLength = isChannelTab
    ? undefined
    : isGroupedReferersView
      ? groupedReferrers.length
      : isDrilledReferersView
        ? drilledMembers?.length
        : data?.length;

  return (
    <AnalyticsCard
      tabs={[
        { id: "channel", label: "Channel" },
        { id: "referers", label: "Referrers" },
        { id: "utm", label: "UTM Parameters" },
      ]}
      selectedTabId={tab}
      onSelectTab={handleTabChange}
      {...subTabProps}
      expandLimit={8}
      dataLength={displayDataLength}
      isFilterActive={isFilterActive}
      onClearFilter={onClearFilter}
    >
      {({ limit, setShowModal, metric }) => {
        if (isChannelTab) {
          return <ChannelBreakdown />;
        }

        // --- Drilled-in raw-domain view under a display name (e.g. "X") ---
        if (isDrilledReferersView) {
          return (
            <div>
              <button
                type="button"
                onClick={() => setDrilledDisplayName(null)}
                className="mb-2 flex items-center gap-1.5 px-3 font-display text-sm font-medium text-content-default hover:text-content-subtle sm:px-4"
              >
                ← {drilledDisplayName}
              </button>
              {drilledMembers && drilledMembers.length > 0 ? (
                <BarList
                  tab={singularTabName}
                  data={drilledMembers}
                  allData={drilledMembers}
                  unit={selectedTab}
                  metric={metric}
                  maxValue={
                    Math.max(
                      ...drilledMembers.map((d) =>
                        (metric === "revenue" ? d.revenue : d.count) ?? 0
                      )
                    ) || 0
                  }
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
                  onRowFilterItem={(val) => onApplyFilterValues([val])}
                  onApplyFilterValues={onApplyFilterValues}
                  currency={currency}
                  kpiLabel={kpiLabel}
                  isGoalKpi={isGoalKpi}
                  kpiConfigured={kpiConfigured}
                />
              ) : (
                <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
                  <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
                    No data available
                  </p>
                </div>
              )}
            </div>
          );
        }

        // --- Top-level referers view, grouped by display name ---
        if (isGroupedReferersView) {
          const groupedForBarList = groupedReferrers.map((s) => ({
            title: s.label,
            filterValue: s.label,
            count: s.value,
            revenue: s.revenue,
          }));

          return groupedForBarList.length > 0 ? (
            <BarList
              tab={singularTabName}
              data={groupedForBarList}
              allData={groupedForBarList}
              unit={selectedTab}
              metric={metric}
              maxValue={
                Math.max(
                  ...groupedForBarList.map((d) =>
                    (metric === "revenue" ? d.revenue : d.count) ?? 0
                  )
                ) || 0
              }
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
              onRowFilterItem={(val) => setDrilledDisplayName(val)} // click drills in, doesn't filter
              onApplyFilterValues={onApplyFilterValues}
              {...(limit && { limit })}
              currency={currency}
              kpiLabel={kpiLabel}
              isGoalKpi={isGoalKpi}
              kpiConfigured={kpiConfigured}
            />
          ) : (
            <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
              <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
                No data available
              </p>
            </div>
          );
        }

        // --- referer_urls and all utm_* subtabs: unchanged flat rendering ---
        return (
          <>
            {data ? (
              data.length > 0 ? (
                <BarList
                  tab={singularTabName}
                  data={
                    data?.map((d) => ({
                      title: d[singularTabName],
                      filterValue: d[singularTabName],
                      count: d.count || 0,
                      revenue: d.revenue || 0,
                    })) || []
                  }
                  allData={allData?.map((d) => ({
                    title: d[singularTabName],
                    filterValue: d[singularTabName],
                    count: d.count || 0,
                    revenue: d.revenue || 0,
                  }))}
                  unit={selectedTab}
                  metric={metric}
                  maxValue={
                    Math.max(
                      ...data.map((d) =>
                        (metric === "revenue" ? d.revenue : d.count) ?? 0
                      )
                    ) || 0
                  }
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
                  onRowFilterItem={(val) => onApplyFilterValues([val])}
                  onApplyFilterValues={onApplyFilterValues}
                  {...(limit && { limit })}
                  currency={currency}
                  kpiLabel={kpiLabel}
                  isGoalKpi={isGoalKpi}
                  kpiConfigured={kpiConfigured}
                />
              ) : (
                <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
                  <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
                    No data available
                  </p>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex h-[250px] w-full items-center justify-center sm:h-[300px]">
                <LoadingSpinner />
              </div>
            )}
          </>
        );
      }}
    </AnalyticsCard>
  );
}