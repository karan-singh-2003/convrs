// "use client";

// import { useState } from "react";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityGroup } from "./activity-group";
// import { ActivitySheet } from "./activity-sheet";
// import { Skeleton } from "@repo/ui";

// type ActivityDay = { date: string; items: ActivityEvent[] };

// export function ActivitySection({
//   activity,
//   isLoading,
//   timeFormatter,
// }: {
//   activity: ActivityDay[];
//   isLoading: boolean;
//   timeFormatter: Intl.DateTimeFormat;
// }) {
//   const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
//   const [sheetDate, setSheetDate] = useState<string | null>(null);

//   const toggleGroup = (date: string) =>
//     setOpenGroups((prev) => ({ ...prev, [date]: !prev[date] }));

//   const sheetItems =
//     activity.find((g) => g.date === sheetDate)?.items ?? [];

//   return (
//     <div className="relative space-y-6 px-4">
//       <h2 className="font-display text-[14.5px] font-medium text-content-subtle">
//         Activity
//       </h2>

//       {isLoading ? (
//         <div className="space-y-3">
//           {Array.from({ length: 8 }).map((_, index) => (
//             <div key={index} className="space-y-0.5">
//               <Skeleton className="h-9 w-70" />
//             </div>
//           ))}
//         </div>
//       ) : activity.length === 0 ? (
//         <p className="font-display text-sm text-content-subtle">
//           No activity recorded yet.
//         </p>
//       ) : (
//         activity.map((group) => (
//           <ActivityGroup
//             key={group.date}
//             date={group.date}
//             items={group.items}
//             isOpen={!!openGroups[group.date]}
//             timeFormatter={timeFormatter}
//             onToggle={() => toggleGroup(group.date)}
//             onShowMore={() => setSheetDate(group.date)}
//           />
//         ))
//       )}

//       <ActivitySheet
//         date={sheetDate}
//         items={sheetItems}
//         timeFormatter={timeFormatter}
//         onOpenChange={(open) => !open && setSheetDate(null)}
//       />
//     </div>
//   );
// }

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityGroup } from "./activity-group";
// import { ActivitySheet } from "./activity-sheet";
// import { Skeleton } from "@repo/ui";

// type ActivityDay = { date: string; items: ActivityEvent[] };

// export function ActivitySection({
//   activity,
//   isLoading,
//   timeFormatter,
//   maxHeight,
// }: {
//   activity: ActivityDay[];
//   isLoading: boolean;
//   timeFormatter: Intl.DateTimeFormat;
//   maxHeight?: number | null;
// }) {
//   const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
//   const [sheetOpen, setSheetOpen] = useState(false);
//   const [isOverflowing, setIsOverflowing] = useState(false);

//   const containerRef = useRef<HTMLDivElement>(null);
//   const contentRef = useRef<HTMLDivElement>(null);

//   const toggleGroup = (date: string) =>
//     setOpenGroups((prev) => ({ ...prev, [date]: !prev[date] }));

//   // Detect whether the full activity content exceeds the capped height
//   useEffect(() => {
//     const el = contentRef.current;
//     if (!el || !maxHeight) {
//       setIsOverflowing(false);
//       return;
//     }

//     const check = () => setIsOverflowing(el.scrollHeight > maxHeight);
//     check();

//     const ro = new ResizeObserver(check);
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, [activity, openGroups, maxHeight]);

//   return (
//     <div className="relative space-y-4 px-4">
//       <h2 className="font-display text-[14.5px] font-medium text-content-subtle">
//         Activity
//       </h2>

//       {isLoading ? (
//         <div className="space-y-3">
//           {Array.from({ length: 8 }).map((_, index) => (
//             <div key={index} className="space-y-0.5">
//               <Skeleton className="h-9 w-70" />
//             </div>
//           ))}
//         </div>
//       ) : activity.length === 0 ? (
//         <p className="font-display text-sm text-content-subtle">
//           No activity recorded yet.
//         </p>
//       ) : (
//         <>
//           <div
//             ref={containerRef}
//             className="overflow-hidden"
//             style={maxHeight ? { maxHeight } : undefined}
//           >
//             <div ref={contentRef} className="space-y-6">
//               {activity.map((group) => (
//                 <ActivityGroup
//                   key={group.date}
//                   date={group.date}
//                   items={group.items}
//                   isOpen={!!openGroups[group.date]}
//                   timeFormatter={timeFormatter}
//                   onToggle={() => toggleGroup(group.date)}
//                 />
//               ))}
//             </div>
//           </div>

//           {isOverflowing && (
//             <button
//               type="button"
//               onClick={() => setSheetOpen(true)}
//               className="text-sm font-medium text-content-subtle hover:text-content-default"
//             >
//               Show more
//             </button>
//           )}
//         </>
//       )}

//       <ActivitySheet
//         open={sheetOpen}
//         activity={activity}
//         openGroups={openGroups}
//         onToggleGroup={toggleGroup}
//         timeFormatter={timeFormatter}
//         onOpenChange={setSheetOpen}
//       />
//     </div>
//   );
// }

"use client";

import { useEffect, useRef, useState } from "react";
import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
import { ActivityGroup } from "./activity-group";
import { ActivitySheet } from "./activity-sheet";
import { Skeleton } from "@repo/ui";

type ActivityDay = { date: string; items: ActivityEvent[] };

export function ActivitySection({
  activity,
  isLoading,
  timeFormatter,
  maxHeight,
}: {
  activity: ActivityDay[];
  isLoading: boolean;
  timeFormatter: Intl.DateTimeFormat;
  maxHeight?: number | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !maxHeight) {
      setIsOverflowing(false);
      return;
    }

    const check = () => setIsOverflowing(el.scrollHeight > maxHeight);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activity, maxHeight]);

  return (
    <div className="relative space-y-4 px-4">
      <h2 className="font-display text-[14.5px] font-medium text-content-subtle">
        Activity
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-0.5">
              <Skeleton className="h-9 w-70" />
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="font-display text-sm text-content-subtle">
          No activity recorded yet.
        </p>
      ) : (
        <>
          <div className="overflow-hidden" style={maxHeight ? { maxHeight } : undefined}>
            <div ref={contentRef} className="space-y-6">
              {activity.map((group) => (
                <ActivityGroup
                  key={group.date}
                  date={group.date}
                  items={group.items}
                  timeFormatter={timeFormatter}
                />
              ))}
            </div>
          </div>

          {isOverflowing && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-sm font-medium text-content-subtle hover:text-content-default"
            >
              Show more
            </button>
          )}
        </>
      )}

      <ActivitySheet
        open={sheetOpen}
        activity={activity}
        timeFormatter={timeFormatter}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}