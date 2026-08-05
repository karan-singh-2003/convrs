// "use client";

// import {
//   DUB_LINKS_ANALYTICS_INTERVAL,
//   INTERVAL_DISPLAYS,
// } from "@/lib/analytics/constants";
// // import { validDateRangeForPlan } from "@/lib/analytics/utils";
// import { getStartEndDates } from "@/lib/analytics/utils/get-start-and-end-dates";
// import useWorkspace from "@/lib/swr/use-workspace";
// import {
//   BlurImage,
//   Button,
//   // ChartLine,
//   DateRangePicker,
//   Filter,
//   // SquareLayoutGrid6,
//   TooltipContent,
//   useMediaQuery,
//   useRouterStuff,
//   useScroll,
// } from "@repo/ui";
// import { APP_DOMAIN, cn, getNextPlan } from "@repo/utils";
// import Link from "next/link";
// import { useParams } from "next/navigation";
// import { useContext } from "react";
// // import { AnalyticsOptions } from "./analytics-options";
// import { AnalyticsContext } from "./analytics-providers";
// // import { ShareButton } from "./share-button";
// import { useAnalyticsFilters } from "./use-analytics-filter";
// import { RefreshCcw } from "lucide-react";
// import { WorkspaceDropdown } from "../layout/sidebar/workspace-dropdown";

// export function AnalyticsToggle({
//   page = "analytics",
//   mode = "private",
//   workspaceName
// }: {
//   page?: "analytics" | "events";
//   mode?: "private" | "public";
//   workspaceName?: string;
// }) {
//   const { slug, programSlug } = useParams();
//   const { plan, createdAt } = useWorkspace();

//   const { queryParams, getQueryString } = useRouterStuff();

//   const {
//     domain,
//     key,
//     url,
//     adminPage,
//     partnerPage,
//     dashboardProps,
//     start,
//     end,
//     interval,
//   } = useContext(AnalyticsContext);



//   const scrolled = useScroll(120);

//   const { isMobile } = useMediaQuery();

//   const {
//     filters,
//     activeFilters,
//     onSelect,
//     onRemove,
//     onRemoveFilter,
//     onRemoveAll,
//     onOpenFilter,
//     onToggleOperator,
//     streaming,
//     activeFiltersWithStreaming,
//   } = useAnalyticsFilters();



//   const filterSelect = (
//     <Filter.Select
//       className="h-9 w-full justify-between gap-2 rounded-full px-3 sm:h-9 sm:w-9 sm:justify-center sm:gap-0 sm:p-0 sm:px-0 sm:[&>span]:hidden sm:[&>svg:last-child]:hidden [&>div]:absolute [&>div]:-right-1 [&>div]:-top-1 [&>div]:size-5 [&>div]:border-2 [&>div]:border-white [&>div]:bg-black [&>div]:text-[10px]"
//       filters={filters}
//       activeFilters={activeFilters}
//       onSelect={onSelect}
//       onRemove={onRemove}
//       onOpenFilter={onOpenFilter}
//       isAdvancedFilter
//       askAI
//     >
//       {"Filter"}
//     </Filter.Select>
//   );

//   const dateRangePicker = (
//     <DateRangePicker
//       className="h-auto w-full px-5 font-normal bg-bg-card border-border-subtle  text-content-default rounded-xl  font-alexandria text-[13px] leading-snug py-2 sm:h-9 sm:w-auto sm:py-0 sm:text-[13.5px] sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap "
//       align={dashboardProps ? "end" : "center"}
//       value={
//         start && end
//           ? {
//             from: start,
//             to: end,
//           }
//           : undefined
//       }
//       presetId={
//         start && end ? undefined : (interval ?? DUB_LINKS_ANALYTICS_INTERVAL)
//       }
//       onChange={(range, preset) => {
//         if (preset) {
//           queryParams({
//             del: ["start", "end"],
//             set: {
//               interval: preset.id,
//             },
//             scroll: false,
//           });

//           return;
//         }

//         if (!range || !range.from || !range.to) return;

//         queryParams({
//           del: "interval",
//           set: {
//             start: range.from.toISOString(),
//             end: range.to.toISOString(),
//           },
//           scroll: false,
//         });
//       }}
//       presets={INTERVAL_DISPLAYS.map(({ display, value, shortcut }) => {
//         const requiresUpgrade = partnerPage;

//         const { startDate, endDate } = getStartEndDates({
//           interval: value,
//           dataAvailableFrom: createdAt,
//         });

//         return {
//           id: value,
//           label: display,
//           dateRange: {
//             from: startDate,
//             to: endDate,
//           },
//           requiresUpgrade,
//           tooltipContent: requiresUpgrade ? (
//             <UpgradeTooltip rangeLabel={display} plan={plan} />
//           ) : undefined,
//           shortcut,
//           mobileLabel: `Last ${display}`,
//         };
//       })}
//     />
//   );

//   // TODO: [PageContent] Remove once all pages are migrated to the new PageContent
//   const isAppPage = !dashboardProps && !adminPage;

//   return (
//     <div className="w-full flex flex-col justify-center gap-2">
//       <div
//         className={cn("py-2 md:py-2", isAppPage && "pt-0 md:pt-0", {
//           "sticky top-14 z-10 justify-between bg-neutral-50": dashboardProps,
//           "sticky top-16 z-10 bg-neutral-50": adminPage,
//           "shadow-md": scrolled && dashboardProps,
//         })}
//       >
//         <div
//           className={cn("mx-auto flex w-full overflow-hidden max-w-screen-xl flex-col ", {
//             "md:h-10": key,
//           })}
//         >
//           <div
//             className={cn(
//               "flex w-full overflow-hidden flex-col items-center justify-between gap-2 md:flex-row",
//               {
//                 "flex-col md:flex-row": !key,
//                 "items-center": key,
//               }
//             )}
//           >
//             {dashboardProps &&
//               (dashboardProps.folderId ? (
//                 <div className="flex items-center gap-2 text-lg font-semibold text-neutral-800">
//                   <p className="max-w-[192px]  truncate sm:max-w-[400px]">
//                     {dashboardProps.folderName}
//                   </p>
//                 </div>
//               ) : (
//                 <div className="flex items-center text-lg font-semibold text-neutral-800">
//                   {/* <BlurImage
//                     alt={url || "Dub"}
//                     src={
//                       url
//                         ? `${GOOGLE_FAVICON_URL}${getApexDomain(url)}`
//                         : DUB_LOGO
//                     }
//                     className="mr-2 h-6 w-6 flex-shrink-0 overflow-hidden rounded-full"
//                     width={48}
//                     height={48}
//                   />
//                   <p className="max-w-[192px] truncate sm:max-w-[400px]">
//                     {linkConstructor({
//                       domain,
//                       key,
//                       pretty: true,
//                     })}
//                   </p> */}
//                 </div>
//               ))}
//             <div
//               className={cn(
//                 "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
//                 dashboardProps && "md:w-auto"
//               )}
//             >
//               <div className="flex items-center gap-2">
//                 {mode === "private" && (
//                   <div>
//                     <WorkspaceDropdown />
//                   </div>
//                 )}
//                 {mode === "public" && (
//                   <div className="border px-4 font-alexandria text-content-subtle text-sm py-2 border-border-subtle rounded-2xl">
//                     <h1>{workspaceName}</h1>
//                   </div>
//                 )}
//                 <div
//                   className={cn(
//                     "flex w-full grow flex-col items-stretch  gap-2 sm:flex-row sm:items-center md:w-auto",
//                     {
//                       "grow-0": dashboardProps,
//                     }
//                   )}
//                 >
//                   {dateRangePicker}
//                   {!dashboardProps &&
//                     // <div className="flex grow justify-end gap-2">
//                     //   {page === "analytics" && (
//                     //     <>
//                     //       <Link
//                     //         href={`/${partnerPage ? `programs/${programSlug}/` : adminPage ? "" : `${slug}/`}events${getQueryString()}`}
//                     //       >
//                     //         <Button
//                     //           variant="secondary"
//                     //           className="w-fit"
//                     //           text={isMobile ? undefined : "View Events"}
//                     //         />
//                     //       </Link>
//                     //     </>
//                     //   )}
//                     //   {page === "events" && (
//                     //     <>
//                     //       <Link
//                     //         href={`/${partnerPage ? `programs/${programSlug}/` : adminPage ? "" : `${slug}/`}analytics${getQueryString()}`}
//                     //       >
//                     //         <Button
//                     //           variant="secondary"
//                     //           className="w-fit"
//                     //           text={isMobile ? undefined : "View Analytics"}
//                     //         />
//                     //       </Link>
//                     //     </>
//                     //   )}
//                     // </div>
//                     null}
//                 </div>
//               </div>
//               {mode !== "public" && (
//                 <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
//                   <div className="rounded-full border border-neutral-200 p-2">
//                     <RefreshCcw size={16} />
//                   </div>
//                   {filterSelect}
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="w-full overflow-x-hidden">
//         <Filter.List
//           filters={filters}
//           activeFilters={activeFiltersWithStreaming}
//           onSelect={onSelect}
//           onRemove={onRemove}
//           onRemoveFilter={onRemoveFilter}
//           onRemoveAll={onRemoveAll}
//           onToggleOperator={onToggleOperator}
//           isAdvancedFilter
//           className="w-full overflow-x-hidden rounded-full"
//         />
//         {/* <div
//           className={cn(
//             "transition-[height] duration-[300ms]",
//             streaming || activeFilters.length ? "h-3" : "h-0"
//           )}
//         /> */}
//       </div>
//     </div>
//   );
// }

// function UpgradeTooltip({
//   rangeLabel,
//   plan,
// }: {
//   rangeLabel: string;
//   plan?: string;
// }) {
//   const { slug } = useWorkspace();

//   const isAllTime = rangeLabel === "All Time";

//   return (
//     <TooltipContent
//       title={`${rangeLabel} can only be viewed on a ${isAllTime ? "Business" : getNextPlan(plan).name} plan or higher. Upgrade now to view more stats.`}
//       cta={`Upgrade to ${isAllTime ? "Business" : getNextPlan(plan).name}`}
//       href={slug ? `/${slug}/upgrade` : APP_DOMAIN}
//     />
//   );
// }


"use client";

import {
  DUB_LINKS_ANALYTICS_INTERVAL,
  INTERVAL_DISPLAYS,
} from "@/lib/analytics/constants";
import { getStartEndDates } from "@/lib/analytics/utils/get-start-and-end-dates";
import useWorkspace from "@/lib/swr/use-workspace";
import {
  BlurImage,
  Button,
  DateRangePicker,
  Filter,
  TooltipContent,
  useMediaQuery,
  useRouterStuff,
  useScroll,
} from "@repo/ui";
import { APP_DOMAIN, cn, getNextPlan } from "@repo/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useContext, useState } from "react";
import { useSWRConfig } from "swr";
import { AnalyticsContext } from "./analytics-providers";
import { useAnalyticsFilters } from "./use-analytics-filter";
import { RefreshCcw } from "lucide-react";
import { WorkspaceDropdown } from "../layout/sidebar/workspace-dropdown";

export function AnalyticsToggle({
  page = "analytics",
  mode = "private",
  workspaceName
}: {
  page?: "analytics" | "events";
  mode?: "private" | "public";
  workspaceName?: string;
}) {
  const { slug, programSlug } = useParams();
  const { plan, createdAt } = useWorkspace();

  const { queryParams, getQueryString } = useRouterStuff();
  const { mutate } = useSWRConfig();

  const {
    domain,
    key,
    url,
    adminPage,
    partnerPage,
    dashboardProps,
    start,
    end,
    interval,
    baseApiPath,
  } = useContext(AnalyticsContext);

  const scrolled = useScroll(120);
  const { isMobile } = useMediaQuery();

  const {
    filters,
    activeFilters,
    onSelect,
    onRemove,
    onRemoveFilter,
    onRemoveAll,
    onOpenFilter,
    onToggleOperator,
    streaming,
    activeFiltersWithStreaming,
  } = useAnalyticsFilters();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !baseApiPath) return;

    setIsRefreshing(true);

    try {
      // revalidate every SWR key whose URL starts with this analytics view's
      // base path (funnel, timeseries, top links, etc. all key off this)
      await mutate(
        (swrKey) =>
          typeof swrKey === "string" && swrKey.startsWith(baseApiPath),
        undefined,
        { revalidate: true },
      );
    } finally {
      // keep the spin visible briefly even if the revalidation is instant,
      // so the click always reads as "something happened"
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [baseApiPath, isRefreshing, mutate]);

  const filterSelect = (
    <Filter.Select
      className="h-9 w-full justify-between gap-2 rounded-full px-3 sm:h-9 sm:w-9 sm:justify-center sm:gap-0 sm:p-0 sm:px-0 sm:[&>span]:hidden sm:[&>svg:last-child]:hidden [&>div]:absolute [&>div]:-right-1 [&>div]:-top-1 [&>div]:size-5 [&>div]:border-2 [&>div]:border-border-subtle [&>div]:bg-content-emphasis [&>div]:text-[10px]"
      filters={filters}
      activeFilters={activeFilters}
      onSelect={onSelect}
      onRemove={onRemove}
      onOpenFilter={onOpenFilter}
      isAdvancedFilter
      askAI
    >
      {"Filter"}
    </Filter.Select>
  );

  const dateRangePicker = (
    <DateRangePicker
      className="h-auto bg-bg-card border-border-subtle w-full px-5 font-normal text-content-default rounded-xl font-alexandria text-[13px] leading-snug py-2 sm:h-9 sm:w-auto sm:py-0 sm:text-[13.5px] sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap"
      align={dashboardProps ? "end" : "center"}
      value={
        start && end
          ? { from: start, to: end }
          : undefined
      }
      presetId={
        start && end ? undefined : (interval ?? DUB_LINKS_ANALYTICS_INTERVAL)
      }
      onChange={(range, preset) => {
        if (preset) {
          queryParams({ del: ["start", "end"], set: { interval: preset.id }, scroll: false });
          return;
        }
        if (!range || !range.from || !range.to) return;
        queryParams({
          del: "interval",
          set: { start: range.from.toISOString(), end: range.to.toISOString() },
          scroll: false,
        });
      }}
      presets={INTERVAL_DISPLAYS.map(({ display, value, shortcut }) => {
        const requiresUpgrade = partnerPage;
        const { startDate, endDate } = getStartEndDates({
          interval: value,
          dataAvailableFrom: createdAt,
        });
        return {
          id: value,
          label: display,
          dateRange: { from: startDate, to: endDate },
          requiresUpgrade,
          tooltipContent: requiresUpgrade ? (
            <UpgradeTooltip rangeLabel={display} plan={plan} />
          ) : undefined,
          shortcut,
          mobileLabel: `Last ${display}`,
        };
      })}
    />
  );

  const isAppPage = !dashboardProps && !adminPage;

  return (
    <div className="w-full flex flex-col justify-center gap-2">
      <div
        className={cn("py-2 md:py-2", isAppPage && "pt-0 md:pt-0", {
          "sticky top-14 z-10 justify-between bg-bg-card rounded-xl ": dashboardProps,
          "sticky top-16 z-10 bg-bg-card": adminPage,
          "shadow-md": scrolled && dashboardProps,
        })}
      >
        <div
          className={cn("mx-auto flex w-full overflow-hidden max-w-screen-xl flex-col ", {
            "md:h-10": key,
          })}
        >
          <div
            className={cn(
              "flex w-full overflow-hidden flex-col items-center justify-between gap-2 md:flex-row",
              { "flex-col md:flex-row": !key, "items-center": key }
            )}
          >
            {dashboardProps &&
              (dashboardProps.folderId ? (
                <div className="flex items-center gap-2 text-lg font-semibold text-content-emphasis">
                  <p className="max-w-[192px] truncate sm:max-w-[400px]">
                    {dashboardProps.folderName}
                  </p>
                </div>
              ) : (
                <div className="flex items-center text-lg font-semibold text-content-emphasis" />
              ))}
            <div
              className={cn(
                "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                dashboardProps && "md:w-auto"
              )}
            >
              <div className="flex items-center gap-2">
                {mode === "private" && (
                  <div>
                    <WorkspaceDropdown />
                  </div>
                )}
                {mode === "public" && (
                  <div className="border px-4 font-alexandria text-content-subtle text-sm py-2 border-subtle rounded-2xl">
                    <h1>{workspaceName}</h1>
                  </div>
                )}
                <div
                  className={cn(
                    "flex w-full grow flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto",
                    { "grow-0": dashboardProps }
                  )}
                >
                  {dateRangePicker}
                </div>
              </div>
              {mode !== "public" && (
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-label="Refresh analytics"
                    className="rounded-full border bg-bg-card border-border-subtle p-2 transition-colors hover:bg-bg-emphasis disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCcw
                      size={18}
                      className={cn(
                        "text-content-subtle",
                        isRefreshing && "animate-spin",
                      )}
                    />
                  </button>
                  {filterSelect}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-hidden">
        <Filter.List
          filters={filters}
          activeFilters={activeFiltersWithStreaming}
          onSelect={onSelect}
          onRemove={onRemove}
          onRemoveFilter={onRemoveFilter}
          onRemoveAll={onRemoveAll}
          onToggleOperator={onToggleOperator}
          isAdvancedFilter
          className="w-full overflow-x-hidden rounded-lg"
        />
      </div>
    </div>
  );
}

function UpgradeTooltip({
  rangeLabel,
  plan,
}: {
  rangeLabel: string;
  plan?: string;
}) {
  const { slug } = useWorkspace();
  const isAllTime = rangeLabel === "All Time";

  return (
    <TooltipContent
      title={`${rangeLabel} can only be viewed on a ${isAllTime ? "Business" : getNextPlan(plan).name} plan or higher. Upgrade now to view more stats.`}
      cta={`Upgrade to ${isAllTime ? "Business" : getNextPlan(plan).name}`}
      href={slug ? `/${slug}/upgrade` : APP_DOMAIN}
    />
  );
}