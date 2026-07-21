// import { Sheet } from "@repo/ui";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityItem } from "./activity-item";

// export function ActivitySheet({
//   date,
//   items,
//   timeFormatter,
//   onOpenChange,
// }: {
//   date: string | null;
//   items: ActivityEvent[];
//   timeFormatter: Intl.DateTimeFormat;
//   onOpenChange: (open: boolean) => void;
// }) {
//   return (
//     <Sheet open={date !== null} onOpenChange={onOpenChange}>
//       <div className="flex items-center justify-between border-b border-border-subtle p-4">
//         <Sheet.Title>Activity — {date}</Sheet.Title>
//         <Sheet.Close asChild>
//           <button className="text-content-subtle hover:text-content-default">
//             ✕
//           </button>
//         </Sheet.Close>
//       </div>

//       <div className="flex-1 space-y-5 overflow-y-auto p-4 font-display">
//         {items.map((item, i) => (
//           <ActivityItem key={i} item={item} timeFormatter={timeFormatter} />
//         ))}
//       </div>
//     </Sheet>
//   );
// }

// import { Sheet } from "@repo/ui";
// import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
// import { ActivityGroup } from "./activity-group";

// type ActivityDay = { date: string; items: ActivityEvent[] };

// export function ActivitySheet({
//   open,
//   activity,
//   openGroups,
//   onToggleGroup,
//   timeFormatter,
//   onOpenChange,
// }: {
//   open: boolean;
//   activity: ActivityDay[];
//   openGroups: Record<string, boolean>;
//   onToggleGroup: (date: string) => void;
//   timeFormatter: Intl.DateTimeFormat;
//   onOpenChange: (open: boolean) => void;
// }) {
//   return (
//     <Sheet open={open} onOpenChange={onOpenChange}>
//       <div className="flex items-center justify-between border-b border-border-subtle p-4">
//         <Sheet.Title>Activity</Sheet.Title>
//         <Sheet.Close asChild>
//           <button className="text-content-subtle hover:text-content-default">
//             ✕
//           </button>
//         </Sheet.Close>
//       </div>

//       <div className="flex-1 space-y-6 overflow-y-auto p-4 font-display">
//         {activity.map((group) => (
//           <ActivityGroup
//             key={group.date}
//             date={group.date}
//             items={group.items}
//             isOpen={!!openGroups[group.date]}
//             timeFormatter={timeFormatter}
//             onToggle={() => onToggleGroup(group.date)}
//           />
//         ))}
//       </div>
//     </Sheet>
//   );
// }

import { Sheet } from "@repo/ui";
import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
import { ActivityGroup } from "./activity-group";

type ActivityDay = { date: string; items: ActivityEvent[] };

export function ActivitySheet({
  open,
  activity,
  timeFormatter,
  onOpenChange,
}: {
  open: boolean;
  activity: ActivityDay[];
  timeFormatter: Intl.DateTimeFormat;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <Sheet.Title>Activity</Sheet.Title>
        <Sheet.Close asChild>
          <button className="text-content-subtle hover:text-content-default">
            ✕
          </button>
        </Sheet.Close>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 font-display">
        {activity.map((group) => (
          <ActivityGroup
            key={group.date}
            date={group.date}
            items={group.items}
            timeFormatter={timeFormatter}
          />
        ))}
      </div>
    </Sheet>
  );
}