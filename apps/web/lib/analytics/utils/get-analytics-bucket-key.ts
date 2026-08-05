import { tz } from "@date-fns/tz";
import { startOfDay, startOfHour, startOfMonth, startOfMinute } from "date-fns";

export type AnalyticsGranularity = "minute" | "hour" | "day" | "month";

export function getAnalyticsBucketKey(
  date: Date | string | number,
  granularity: AnalyticsGranularity,
  timezone?: string
): string {
  const d = new Date(date);
  const options = timezone ? { in: tz(timezone) } : undefined;

  let bucketDate: Date;
  switch (granularity) {
    case "minute":
      bucketDate = startOfMinute(d, options);
      break;
    case "hour":
      bucketDate = startOfHour(d, options);
      break;
    case "month":
      bucketDate = startOfMonth(d, options);
      break;
    case "day":
    default:
      bucketDate = startOfDay(d, options);
      break;
  }

  return bucketDate.toISOString();
}
