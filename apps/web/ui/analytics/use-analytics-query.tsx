"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import type { EventType } from "./types";
import useWorkspace from "@/lib/swr/use-workspace";

const DEFAULT_INTERVAL = "7d";

export function useAnalyticsQuery() {
  const searchParams = useSearchParams();
  const { id: workspaceId } = useWorkspace();
 
  // Metric
  const selectedTab: EventType = useMemo(() => {
    return (searchParams.get("event") as EventType) || "visitors";
  }, [searchParams]);

  // Date range
  const { start, end } = useMemo(() => {
    const hasRange = searchParams.get("start") && searchParams.get("end");

    if (hasRange) {
      return {
        start: startOfDay(new Date(searchParams.get("start")!)),
        end: endOfDay(new Date(searchParams.get("end")!)),
      };
    }

    return {
      start: subDays(new Date(), 7),
      end: new Date(),
    };
  }, [searchParams]);

  // Interval
  const interval = searchParams.get("interval") || DEFAULT_INTERVAL;

  // Filters
  const filters = useMemo(() => {
    const result: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      if (!["event", "start", "end", "interval"].includes(key)) {
        result[key] = value;
      }
    });

    return result;
  }, [searchParams]);

  // Query string builder
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("event", selectedTab);
    params.set("start", start.toISOString());
    params.set("end", end.toISOString());
    params.set("interval", interval);

    //  Inject workspaceId explicitly
    if (workspaceId) {
      params.set("workspaceId", workspaceId);
    }

    // Optional: timezone (if your backend expects it)
    params.set(
      "timezone",
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );

    // Filters
    Object.entries(filters).forEach(([key, value]) => {
      if (!["workspaceId", "timezone"].includes(key)) {
        params.set(key, value);
      }
    });

    return params.toString();
  }, [selectedTab, start, end, interval, filters, workspaceId]);

  return {
    queryString,
    selectedTab,
    start,
    end,
    interval,
    filters,
    workspaceId, // optional but useful
  };
}