"use client";

import { PropsWithChildren, useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { createContext } from "react";
import { useAnalyticsQuery } from "./use-analytics-query";
import useWorkspace from "@/lib/swr/use-workspace";

type AnalyticsApiResponse = {
  data: AnalyticsResponse;
  workspaceId: string;
  userId: string;
};

export type AnalyticsContextType = {
  // Query
  start: Date;
  end: Date;
  interval: string;
  selectedTab: string;
  queryString: string;
  filters: Record<string, string>;

  //  View/UI
  view: "timeseries" | "table";
  setView: (v: "timeseries" | "table") => void;

  //  Data
  totalEvents: AnalyticsResponse | null;
  loading: boolean;

  // Meta
  requiresUpgrade: boolean;
};

export const AnalyticsContext = createContext<AnalyticsContextType>(
  {} as AnalyticsContextType
);

export function AnalyticsProvider({ children }: PropsWithChildren) {
  // View state
  const [view, setView] = useState<"timeseries" | "table">("timeseries");

  // Get workspace ID
  const { id: workspaceId } = useWorkspace();

  // Build query from URL
  const { queryString, start, end, interval, selectedTab, filters } =
    useAnalyticsQuery();


  // Fetch data - dependency on queryString ensures refetch when filters change
  const { data, isLoading, error } = useSWR<AnalyticsApiResponse>(
    workspaceId && queryString ? `/api/analytics?${queryString}` : null,
    fetcher,
    {
      dedupingInterval: 60000, // Don't refetch same query within 60s
      focusThrottleInterval: 300000, // Throttle on window focus
    }
  );

  const requiresUpgrade = error?.status === 403;

  return (
    <AnalyticsContext.Provider
      value={{
        start,
        end,
        interval,
        selectedTab,
        queryString,
        filters,
        view,
        setView,
        totalEvents: data?.data || null,
        loading: isLoading,
        requiresUpgrade,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export type AnalyticsResponseOptions =
  | "visitors"
  | "revenue"
  | "conversionRate"
  | "bounceRate"
  | "sessions"
  | "online"
  | "conversionrate"
  | "bouncerate";

export type AnalyticsMetrics = {
  events?: number;
  visitors?: number;
  revenue?: number;
  online?: number;
  avgSession?: number;
  conversionRate?: number;
  bounceRate?: number;
  conversionrate?: number;
  bouncerate?: number;
  sessions?: number;
  [key: string]: number | undefined;
};

export type AnalyticsResponse = {
  current: AnalyticsMetrics;
  previous: AnalyticsMetrics;
};
