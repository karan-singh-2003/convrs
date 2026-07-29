// "use client";

// import { useState } from "react";
// import { ArrowDownUp } from "lucide-react";
// import { Modal } from "@repo/ui";
// import { cn } from "@repo/utils";
// import { BarList } from "./bar-list";
// import { GoalsAreaChart } from "./goals-area-chart";

// type GoalsCardProps = {
//     chartData: { date: Date; values: Record<string, number> }[];
//     goalNames: string[];
//     chartLoading: boolean;
//     selectedGoal: string | null;
//     onSelectGoal: (goal: string | null) => void;

//     // BarList data + handlers, passed straight through from LowerGrid
//     data: any[];
//     allData: any[];
//     totalVisitors?: number;
//     unit: string;
//     maxValue: number;
//     isFilterActive?: boolean;
//     selectedItems: string[];
//     activeFilterValues: string[];
//     onToggleFilter: (val: string) => void;
//     onClearFilter: () => void;
//     onClearSelection: () => void;
//     onRowFilterItem: (val: string) => void;
//     onExpandRow: (val: string) => void;
//     kpiLabel: string;
//     isGoalKpi: boolean;
//     kpiConfigured: boolean;
//     expandLimit?: number;
//     barBackground: string;
//     hoverBackground: string;
// };

// export function GoalsCard({
//     chartData,
//     goalNames,
//     chartLoading,
//     selectedGoal,
//     onSelectGoal,
//     data,
//     allData,
//     totalVisitors,
//     unit,
//     maxValue,
//     isFilterActive,
//     selectedItems,
//     activeFilterValues,
//     onToggleFilter,
//     onClearFilter,
//     onClearSelection,
//     onRowFilterItem,
//     onExpandRow,
//     kpiLabel,
//     isGoalKpi,
//     kpiConfigured,
//     barBackground = "bg-bg-bar-primary",
//     hoverBackground = "hover:bg-bg-subtle",
//     expandLimit = 6,
// }: GoalsCardProps) {
//     const [showModal, setShowModal] = useState(false);
//     const [metric, setMetric] = useState<"clicks" | "revenue">("clicks");

//     const showViewAll = data.length > expandLimit;

//     const barListSharedProps = {
//         tab: "goal",
//         data,
//         allData,
//         totalVisitors,
//         unit,
//         metric,
//         maxValue,
//         setShowModal,
//         activeFilterValues,
//         onToggleFilter,
//         onClearFilter,
//         onClearSelection,
//         onRowFilterItem,
//         onExpandRow,
//         kpiLabel,
//         isGoalKpi,
//         kpiConfigured,
//         barBackground,
//         hoverBackground,
//     };

//     return (
//         <>
//             {/* "View all" modal — full, unlimited, searchable BarList */}
//             <Modal showModal={showModal} setShowModal={setShowModal} className="max-w-lg px-0">
//                 <BarList {...barListSharedProps} selectedFilterValues={selectedItems} placeholder="goals" />
//             </Modal>

//             <div className="relative z-0 flex h-[400px] w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-card sm:h-[450px] sm:rounded-xl">
//                 {/* Left pane — chart */}
//                 <div className="flex min-w-0 flex-1 flex-col border-r border-border-subtle">
//                     <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5 sm:px-4">
//                         <span className="font-display text-sm font-medium text-content-default sm:text-[15px]">
//                             Goals over time
//                         </span>
//                     </div>
//                     <div className="min-h-0 flex-1 p-3 sm:p-4">
//                         <GoalsAreaChart
//                             chartData={chartData}
//                             goalNames={goalNames}
//                             selectedGoal={selectedGoal}
//                             onSelectGoal={onSelectGoal}
//                             isLoading={chartLoading}
//                         />
//                     </div>
//                 </div>

//                 {/* Right pane — top goals list */}
//                 <div className="flex w-[300px] shrink-0 flex-col sm:w-[340px]">
//                     <div className="flex items-center justify-between px-3 py-2.5 sm:px-4">
//                         <span className="font-display text-sm font-medium text-content-default sm:text-[15px]">
//                             Top goals
//                         </span>
//                         <button
//                             type="button"
//                             onClick={() => setMetric((m) => (m === "clicks" ? "revenue" : "clicks"))}
//                             className="flex items-center gap-1 text-content-subtle hover:text-content-default transition-colors"
//                         >
//                             <p className="flex items-center gap-1 font-display text-[13px] font-medium capitalize">
//                                 {metric}
//                                 <ArrowDownUp size={13} />
//                             </p>
//                         </button>
//                     </div>

//                     <div className={cn("relative min-h-0 flex-1", showViewAll && "pb-16")}>
//                         {data.length > 0 ? (
//                             <BarList {...barListSharedProps} limit={expandLimit} selectedFilterValues={selectedItems} />
//                         ) : (
//                             <div className="flex h-full items-center justify-center px-4 text-center">
//                                 <p className="text-xs font-poppins font-medium text-content-subtle sm:text-[13px]">
//                                     No data available
//                                 </p>
//                             </div>
//                         )}

//                         {showViewAll && (
//                             <div className="absolute bottom-0 left-0 z-10 flex w-full items-end">
//                                 <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-bg-card via-bg-card/90 to-transparent" />
//                                 <div className="relative flex w-full items-center justify-center px-3 py-3">
//                                     <button
//                                         onClick={() => setShowModal(true)}
//                                         className="h-9 w-full rounded-xl border border-border-subtle bg-bg-card px-4 font-display text-[13px] font-medium text-content-default shadow-sm transition-all hover:bg-bg-subtle active:scale-[0.98]"
//                                     >
//                                         View All
//                                     </button>
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </>
//     );
// }

"use client";

import { useState } from "react";
import { ArrowDownUp, ArrowLeft } from "lucide-react";
import { Modal } from "@repo/ui";
import { cn } from "@repo/utils";
import { BarList } from "./bar-list";
import { GoalsAreaChart } from "./goals-area-chart";
import { GoalPropertiesPanel } from "./goals-panel";

type GoalsCardProps = {
  chartData: { date: Date; values: Record<string, number> }[];
  goalNames: string[];
  chartLoading: boolean;
  selectedGoal: string | null;
  onSelectGoal: (goal: string | null) => void;

  data: any[];
  allData: any[];
  totalVisitors?: number;
  unit: string;
  maxValue: number;
  isFilterActive?: boolean;
  selectedItems: string[];
  activeFilterValues: string[];
  onToggleFilter: (val: string) => void;
  onClearFilter: () => void;
  onClearSelection: () => void;
  kpiLabel: string;
  isGoalKpi: boolean;
  kpiConfigured: boolean;
  expandLimit?: number;
  barBackground: string;
  hoverBackground: string;
};

export function GoalsCard({
  chartData,
  goalNames,
  chartLoading,
  selectedGoal,
  onSelectGoal,
  data,
  allData,
  totalVisitors,
  unit,
  maxValue,
  isFilterActive,
  selectedItems,
  activeFilterValues,
  onToggleFilter,
  onClearFilter,
  onClearSelection,
  kpiLabel,
  isGoalKpi,
  kpiConfigured,
  barBackground = "bg-bg-bar-primary",
  hoverBackground = "hover:bg-bg-subtle",
  expandLimit = 6,
}: GoalsCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [metric, setMetric] = useState<"clicks" | "revenue">("clicks");

  const showViewAll = data.length > expandLimit;
  const showingProperties = !!selectedGoal;

  const barListSharedProps = {
    tab: "goal",
    data,
    allData,
    totalVisitors,
    unit,
    metric,
    maxValue,
    setShowModal,
    activeFilterValues,
    onToggleFilter,
    onClearFilter,
    onClearSelection,
    // Selecting a goal drives BOTH the chart isolation and the right-pane view —
    // no separate "open modal" side effect anymore.
    onRowFilterItem: (val: string) => onSelectGoal(val),
    onExpandRow: (val: string) => onSelectGoal(val),
    kpiLabel,
    isGoalKpi,
    kpiConfigured,
    barBackground,
    hoverBackground,
  };

  return (
    <>
      {/* "View all" modal — full, unlimited, searchable list. Still list-only;
          picking a goal here closes the modal and switches the pane, same as the inline list. */}
      <Modal showModal={showModal} setShowModal={setShowModal} className="max-w-lg px-0">
        <BarList
          {...barListSharedProps}
          onRowFilterItem={(val: string) => {
            onSelectGoal(val);
            setShowModal(false);
          }}
          selectedFilterValues={selectedItems}
          placeholder="goals"
        />
      </Modal>

      <div className="relative z-0 flex h-[400px] w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-card sm:h-[450px] sm:rounded-xl">
        {/* Left pane — chart */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-border-subtle">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5 sm:px-4">
            <span className="font-display text-sm font-medium text-content-default sm:text-[15px]">
              Goals over time
            </span>
          </div>
          <div className="min-h-0 flex-1 p-3 sm:p-4">
            <GoalsAreaChart
              chartData={chartData}
              goalNames={goalNames}
              selectedGoal={selectedGoal}
              onSelectGoal={onSelectGoal}
              isLoading={chartLoading}
            />
          </div>
        </div>

        {/* Right pane — list, or a single goal's properties when one is selected */}
        <div className="flex w-[300px] shrink-0 flex-col sm:w-[340px]">
          <div className="flex items-center justify-between px-3 py-2.5 sm:px-4">
            {showingProperties ? (
              <button
                type="button"
                onClick={() => onSelectGoal(null)}
                className="flex min-w-0 items-center gap-1.5 text-content-default hover:text-content-subtle transition-colors"
              >
                <ArrowLeft size={14} className="shrink-0" />
                <span className="truncate font-display text-sm font-medium sm:text-[15px]">
                  {selectedGoal}
                </span>
              </button>
            ) : (
              <>
                <span className="font-display text-sm font-medium text-content-default sm:text-[15px]">
                  Top goals
                </span>
                <button
                  type="button"
                  onClick={() => setMetric((m) => (m === "clicks" ? "revenue" : "clicks"))}
                  className="flex items-center gap-1 text-content-subtle hover:text-content-default transition-colors"
                >
                  <p className="flex items-center gap-1 font-display text-[13px] font-medium capitalize">
                    {metric}
                    <ArrowDownUp size={13} />
                  </p>
                </button>
              </>
            )}
          </div>

          <div className={cn("relative min-h-0 flex-1 ", showViewAll && !showingProperties && "pb-16")}>
            {showingProperties ? (
              <GoalPropertiesPanel goalName={selectedGoal!} />
            ) : data.length > 0 ? (
              <BarList {...barListSharedProps} limit={expandLimit} selectedFilterValues={selectedItems} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <p className="text-xs font-poppins font-medium text-content-subtle sm:text-[13px]">
                  No data available
                </p>
              </div>
            )}

            {showViewAll && !showingProperties && (
              <div className="absolute bottom-0 left-0 z-10 flex w-full items-end">
                <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-bg-card via-bg-card/90 to-transparent" />
                <div className="relative flex w-full items-center justify-center px-3 py-3">
                  <button
                    onClick={() => setShowModal(true)}
                    className="h-9 w-full rounded-xl border border-border-subtle bg-bg-card px-4 font-display text-[13px] font-medium text-content-default shadow-sm transition-all hover:bg-bg-subtle active:scale-[0.98]"
                  >
                    View All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}