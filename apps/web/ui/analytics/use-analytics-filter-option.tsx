"use client";

import { useContext, useMemo } from "react";
import useSWR from "swr";

import { fetcher } from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import type { GroupByType } from "./types";
import { AnalyticsContext } from "./analytics-providers";

type AnalyticsFilterItem = {
  value: string;
  count: number;
  [key: string]: string | number;
};

type TinybirdResponse = {
  groupByField: string;
  count: number;
  [key: string]: any;
};

type ApiResponse = {
  data: TinybirdResponse[];
  meta?: {
    workspaceId: string;
    userId: string;
    event: string;
    groupBy: string;
    timestamp: string;
  };
};

export function useAnalyticsFilterOption(
  groupBy: GroupByType,
  options?: {
    disabled?: boolean;
  }
) {
  const { queryString } = useContext(AnalyticsContext);
  const { id: workspaceId } = useWorkspace();

  const url = useMemo(() => {
    if (options?.disabled || !queryString || !workspaceId) return null;

    return `/api/analytics?${queryString}&groupBy=${groupBy}`;
  }, [queryString, groupBy, options?.disabled, workspaceId]);

  const { data: apiResponse, isLoading } = useSWR<ApiResponse>(url, fetcher, {
    dedupingInterval: 60000,
  });

  // Extract data array from API response and transform to expected format
  const data: AnalyticsFilterItem[] | null = useMemo(() => {
    const rawData = apiResponse?.data;

    if (!rawData || !Array.isArray(rawData)) {
      return null;
    }

    const transformed = rawData
      .map((item) => ({
        value: item.groupByField || "",
        count: item.count || 0,
      }))
      .filter((item) => item.value && item.count > 0); // Filter out empty entries

    return transformed;
  }, [apiResponse, groupBy]);

  return {
    data,
    loading: isLoading,
  };
}
