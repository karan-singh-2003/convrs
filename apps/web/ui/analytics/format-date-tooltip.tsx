import { getDaysDifference } from "@repo/utils";
import { isToday } from "date-fns";

export const formatDateTooltip = (
  date: Date,
  {
    interval,
    start,
    end,
    dataAvailableFrom,
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  }: {
    interval?: string;
    start?: string | Date | null;
    end?: string | Date | null;
    dataAvailableFrom?: Date;
    timezone?: string;
  },
) => {
  // Convert date to local timezone (or provided timezone if specified)
  const targetDate = new Date(
    date.toLocaleString("en-US", { timeZone: timezone }),
  );

  if (interval === "all" && dataAvailableFrom) {
    start = dataAvailableFrom;
    end = new Date(Date.now());
  }

  if (start && end) {
    const daysDifference = getDaysDifference(start, end);

    if (daysDifference <= 2) {
      const time = targetDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
      });

      return isToday(targetDate) ? `Today, ${time}` : time;
    }
    else if (daysDifference > 180)
      return targetDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
  } else if (interval) {
    switch (interval) {
      case "24h": {
        const time = targetDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
        });

        return isToday(targetDate) ? `Today, ${time}` : time;
      }
      case "ytd":
      case "1y":
      case "all":
        return targetDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      default:
        break;
    }
  }

  return targetDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};