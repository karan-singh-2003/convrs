import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
import { eventIcon, eventTitle } from "@/lib/customers/activity-display";
import { formatTime } from "@/lib/customers/format";

export function ActivityItem({
  item,
  timeFormatter,
}: {
  item: ActivityEvent;
  timeFormatter: Intl.DateTimeFormat;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-x-3 text-content-default">
        {eventIcon(item)}

        <div>
          <p
            className={`font-display text-[14px] font-medium ${
              item.event_type === "revenue"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-content-default"
            }`}
          >
            {eventTitle(item)}
          </p>

          {item.referer &&
            item.referer !== "(direct)" &&
            item.referer.startsWith("http") && (
              <p className="text-xs text-content-subtle">via {item.referer}</p>
            )}

          {item.utm_campaign && (
            <p className="text-xs text-content-subtle">
              campaign: {item.utm_campaign}
            </p>
          )}
        </div>
      </div>

      <span className="whitespace-nowrap text-xs text-content-subtle">
        {formatTime(item.timestamp, timeFormatter)}
      </span>
    </div>
  );
}