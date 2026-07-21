// import { ChevronDown } from "lucide-react";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityItem } from "./activity-item";

// const VISIBLE_ITEM_LIMIT = 5;

// export function ActivityGroup({
//   date,
//   items,
//   isOpen,
//   timeFormatter,
//   onToggle,
//   onShowMore,
// }: {
//   date: string;
//   items: ActivityEvent[];
//   isOpen: boolean;
//   timeFormatter: Intl.DateTimeFormat;
//   onToggle: () => void;
//   onShowMore: () => void;
// }) {
//   const hasMore = items.length > VISIBLE_ITEM_LIMIT;
//   const visibleItems = items.slice(0, VISIBLE_ITEM_LIMIT);

//   return (
//     <div className="space-y-3">
//       <p
//         className="flex cursor-pointer items-center gap-x-2 font-display text-[14.5px] font-medium text-content-default"
//         onClick={onToggle}
//       >
//         {date}
//         <ChevronDown
//           size={16}
//           className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
//         />
//       </p>

//       {isOpen && (
//         <div className="space-y-5 rounded-2xl p-3 bg-bg-card font-display">
//           {visibleItems.map((item, i) => (
//             <ActivityItem key={i} item={item} timeFormatter={timeFormatter} />
//           ))}

//           {hasMore && (
//             <button
//               type="button"
//               onClick={onShowMore}
//               className="text-sm font-medium text-content-subtle hover:text-content-default"
//             >
//               Show more ({items.length - VISIBLE_ITEM_LIMIT} more)
//             </button>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// import { ChevronDown } from "lucide-react";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityItem } from "./activity-item";

// export function ActivityGroup({
//   date,
//   items,
//   isOpen,
//   timeFormatter,
//   onToggle,
// }: {
//   date: string;
//   items: ActivityEvent[];
//   isOpen: boolean;
//   timeFormatter: Intl.DateTimeFormat;
//   onToggle: () => void;
// }) {
//   return (
//     <div className="space-y-3">
//       <p
//         className="flex cursor-pointer items-center gap-x-2 font-display text-[14.5px] font-medium text-content-default"
//         onClick={onToggle}
//       >
//         {date}
//         <ChevronDown
//           size={16}
//           className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
//         />
//       </p>

//       {isOpen && (
//         <div className="space-y-5 rounded-2xl p-3 bg-bg-card font-display">
//           {items.map((item, i) => (
//             <ActivityItem key={i} item={item} timeFormatter={timeFormatter} />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
import { ActivityItem } from "./activity-item";

export function ActivityGroup({
  date,
  items,
  timeFormatter,
}: {
  date: string;
  items: ActivityEvent[];
  timeFormatter: Intl.DateTimeFormat;
}) {
  return (
    <div className="space-y-3">
      <p className="font-display text-[14.5px] font-medium text-content-default">
        {date}
      </p>

      <div className="space-y-5 rounded-2xl p-3 bg-bg-card font-display">
        {items.map((item, i) => (
          <ActivityItem key={i} item={item} timeFormatter={timeFormatter} />
        ))}
      </div>
    </div>
  );
}