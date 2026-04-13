"use client";

import {
  ANALYTICS_SALE_UNIT,
  ANALYTICS_VIEWS,
  DUB_LINKS_ANALYTICS_INTERVAL,
  DUB_PARTNERS_ANALYTICS_INTERVAL,
} from "@/lib/analytics/constants";
import {
  AnalyticsResponseOptions,
  AnalyticsSaleUnit,
  AnalyticsView,
  EventType,
} from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import { calculatePercentageChange } from "@/lib/analytics/utils/calculate-percentage-change";
import { getPlanCapabilities } from "@/lib/plan-capabilities";
import useWorkspace from "@/lib/swr/use-workspace";
import { UpgradeRequiredToast } from "@/ui/shared/upgrade-required-toast";
import { PlanProps } from "@/lib/types";
import { useLocalStorage } from "@repo/ui";
import { fetcher } from "@repo/utils";
import { useParams, useSearchParams } from "next/navigation";
import {
  createContext,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { defaultConfig } from "swr/_internal";
import { useAnalyticsQuery } from "./use-analytics-query";
import { subDays, differenceInDays } from "date-fns";

export type AnalyticsDashboardProps = {
  showConversions?: boolean;
  workspacePlan?: PlanProps;
} & (
  | {
      domain: string;
      key: string;
      url: string;
      folderId?: never;
      folderName?: never;
    }
  | {
      folderId: string;
      folderName: string;
      domain?: never;
      key?: never;
      url?: never;
    }
);

export const AnalyticsContext = createContext<{
  basePath: string;
  baseApiPath: string;
  eventsApiPath?: string;
  selectedTab: EventType;
  saleUnit: AnalyticsSaleUnit;
  view: AnalyticsView;
  domain?: string;
  key?: string;
  url?: string;
  folderId?: string;
  queryString: string;
  start?: Date;
  end?: Date;
  interval?: string;
  tagId?: string;
  totalEvents?: {
    [key in AnalyticsResponseOptions]: number;
  };
  percentageChanges?: {
    [key in AnalyticsResponseOptions]?: number | null;
  };
  totalEventsLoading?: boolean;
  adminPage?: boolean;
  partnerPage?: boolean;
  showConversions?: boolean;
  fetchCompositeStats?: boolean;
  requiresUpgrade?: boolean;
  dashboardProps?: AnalyticsDashboardProps;
}>({
  basePath: "",
  baseApiPath: "",
  eventsApiPath: "",
  selectedTab: "clicks",
  saleUnit: "saleAmount",
  view: "timeseries",
  domain: "",
  queryString: "",
  start: new Date(),
  end: new Date(),
  adminPage: false,
  partnerPage: false,
  showConversions: false,
  fetchCompositeStats: false,
  requiresUpgrade: false,
  dashboardProps: undefined,
  percentageChanges: {},
});

export default function AnalyticsProvider({
  adminPage,
  dashboardProps,
  children,
}: PropsWithChildren<{
  adminPage?: boolean;
  dashboardProps?: AnalyticsDashboardProps;
}>) {
  const searchParams = useSearchParams();
  const { slug: workspaceSlug, plan: workspacePlan } = useWorkspace();

  const [requiresUpgrade, setRequiresUpgrade] = useState(false);

  const { dashboardId, programSlug } = useParams() as {
    dashboardId?: string;
    programSlug?: string;
  };

  const domainSlug = searchParams?.get("domain");

  // Show conversion tabs/data for all dashboards except shared (unless explicitly set)
  const showConversions =
    !dashboardProps || dashboardProps?.showConversions ? true : false;

  const [persistedSaleUnit, setPersistedSaleUnit] =
    useLocalStorage<AnalyticsSaleUnit>(`analytics-sale-unit`, "saleAmount");

  const saleUnit: AnalyticsSaleUnit = useMemo(() => {
    const searchParamsSaleUnit = searchParams.get(
      "saleUnit"
    ) as AnalyticsSaleUnit;
    if (ANALYTICS_SALE_UNIT.includes(searchParamsSaleUnit)) {
      setPersistedSaleUnit(searchParamsSaleUnit);
      return searchParamsSaleUnit;
    }
    return persistedSaleUnit;
  }, [searchParams.get("saleUnit")]);

  const [persistedView, setPersistedView] = useLocalStorage<AnalyticsView>(
    `analytics-view`,
    "timeseries"
  );
  const view: AnalyticsView = useMemo(() => {
    const searchParamsView = searchParams.get("view") as AnalyticsView;
    if (ANALYTICS_VIEWS.includes(searchParamsView)) {
      setPersistedView(searchParamsView);
      return searchParamsView;
    }

    return ANALYTICS_VIEWS.includes(persistedView)
      ? persistedView
      : "timeseries";
  }, [searchParams.get("view")]);

  const { basePath, domain, baseApiPath, eventsApiPath } = useMemo(() => {
    if (adminPage) {
      return {
        basePath: "analytics",
        baseApiPath: "/api/admin/analytics",
        eventsApiPath: "/api/admin/events",
        domain: domainSlug,
      };
    } else if (workspaceSlug) {
      return {
        basePath: `/${workspaceSlug}/analytics`,
        baseApiPath: "/api/analytics",
        eventsApiPath: "/api/events",
        domain: domainSlug,
      };
    } else if (dashboardId) {
      // Public stats page, e.g. app.dub.co/share/dsh_123
      return {
        basePath: `/share/${dashboardId}`,
        baseApiPath: "/api/analytics/dashboard",
        domain: dashboardProps?.domain ?? null,
      };
    } else {
      return {
        basePath: "",
        baseApiPath: "",
        domain: "", // TODO [refactor]
      };
    }
  }, [
    adminPage,
    workspaceSlug,
    dashboardProps?.domain,
    dashboardId,
    domainSlug,
  ]);

  const {
    queryString,
    key,
    start,
    end,
    interval,
    tagId,
    folderId,
    selectedTab,
  } = useAnalyticsQuery({
    domain: domain ?? undefined,
    defaultKey: dashboardProps?.key,
    defaultFolderId: dashboardProps?.folderId,
    defaultInterval: DUB_LINKS_ANALYTICS_INTERVAL,
  });

  // Reset requiresUpgrade when query changes
  useEffect(() => setRequiresUpgrade(false), [queryString]);

  const { canTrackConversions } = getPlanCapabilities(workspacePlan);

  const fetchCompositeStats = useMemo(() => {
    // show composite stats if:
    // - shared dashboard and show conversions is set to true
    // - it's an admin or partner page
    // - it's a workspace that has tracked conversions/customers/leads before
    return dashboardProps?.showConversions ||
      adminPage ||
      canTrackConversions === true
      ? true
      : false;
  }, [dashboardProps?.showConversions, adminPage, canTrackConversions]);

  // Build current period query
  const currentQueryUrl = useMemo(() => {
    return `${baseApiPath}?${editQueryString(queryString, {
      event: fetchCompositeStats ? "composite" : "clicks",
    })}`;
  }, [baseApiPath, queryString, fetchCompositeStats]);

  // Build previous period query (same length as current period)
  const previousQueryUrl = useMemo(() => {
    try {
      if (!start || !end) {
        // For interval-based queries, calculate previous period
        const params = new URLSearchParams(queryString);
        const interval = params.get("interval");

        if (interval) {
          // Get the length of the current period in days
          // Default intervals: 24h, 7d, 30d, 90d, 1y, etc.
          let daysDifference = 1;
          if (interval === "24h") daysDifference = 1;
          else if (interval === "7d") daysDifference = 7;
          else if (interval === "30d") daysDifference = 30;
          else if (interval === "90d") daysDifference = 90;
          else if (interval === "1y" || interval === "365d")
            daysDifference = 365;

          const prevEnd = subDays(new Date(), daysDifference);
          const prevStart = subDays(prevEnd, daysDifference);

          params.set("start", prevStart.toISOString());
          params.set("end", prevEnd.toISOString());
          params.delete("interval");

          // Ensure event is set
          params.set("event", fetchCompositeStats ? "composite" : "clicks");

          return `${baseApiPath}?${params.toString()}`;
        }
      } else if (start && end) {
        // For custom date ranges
        const daysDifference = differenceInDays(end, start);
        const prevEnd = subDays(start, 1);
        const prevStart = subDays(prevEnd, daysDifference);

        const params = new URLSearchParams(queryString);
        params.set("start", prevStart.toISOString());
        params.set("end", prevEnd.toISOString());
        params.set("event", fetchCompositeStats ? "composite" : "clicks");

        return `${baseApiPath}?${params.toString()}`;
      }
    } catch (error) {
      console.error("Error building previous query URL:", error);
    }

    return null;
  }, [queryString, baseApiPath, start, end, fetchCompositeStats]);
  
  console.log("Current query URL:", currentQueryUrl);
  // Fetch current period data
  const { data: apiResponse, isLoading: totalEventsLoading } = useSWR<{
    data: Array<{ [key in AnalyticsResponseOptions]: number }>;
  }>(currentQueryUrl, fetcher, {
    keepPreviousData: true,
    onSuccess: () => setRequiresUpgrade(false),
    onError: (error) => {
      try {
        const errorMessage = error.message;
        if (
          error.status === 403 &&
          errorMessage.toLowerCase().includes("upgrade")
        ) {
          toast.custom(() => (
            <UpgradeRequiredToast
              title="Upgrade for more analytics"
              message={errorMessage}
            />
          ));
          setRequiresUpgrade(true);
        } else {
          toast.error(errorMessage);
        }
      } catch (error) {
        toast.error(error);
      }
    },
    onErrorRetry: (error, ...args) => {
      if (error.message.includes("Upgrade to Pro")) return;
      defaultConfig.onErrorRetry(error, ...args);
    },
  });

  // Fetch previous period data
  const { data: previousApiResponse } = useSWR<{
    data: Array<{ [key in AnalyticsResponseOptions]: number }>;
  }>(previousQueryUrl, fetcher, {
    keepPreviousData: true,
    onError: () => {
      // Silently fail on previous period fetch
    },
  });

  // Extract the metrics object from the API response
  const totalEvents = apiResponse?.data?.[0];
  const previousTotalEvents = previousApiResponse?.data?.[0];

  // Calculate percentage changes
  const percentageChanges = useMemo(() => {
    if (!totalEvents || !previousTotalEvents) {
      console.log("Analytics percentage change debug:", {
        currentUrl: currentQueryUrl,
        previousUrl: previousQueryUrl,
        hasTotalEvents: !!totalEvents,
        hasPreviousEvents: !!previousTotalEvents,
        totalEvents,
        previousTotalEvents,
      });
      return {};
    }

    const changes: {
      [key in AnalyticsResponseOptions]?: number | null;
    } = {};

    (Object.keys(totalEvents) as Array<keyof typeof totalEvents>).forEach(
      (key) => {
        const current = totalEvents[key];
        const previous = previousTotalEvents[key];
        changes[key] = calculatePercentageChange(current, previous);
      }
    );

    console.log("Calculated percentage changes:", changes);
    return changes;
  }, [totalEvents, previousTotalEvents]);

  return (
    <AnalyticsContext.Provider
      value={{
        basePath, // basePath for the page (e.g. /[slug]/analytics, /share/[dashboardId])
        baseApiPath, // baseApiPath for analytics API endpoints (e.g. /api/analytics)
        selectedTab, // selected event tab (clicks, leads, sales)
        eventsApiPath, // eventsApiPath for events API endpoints (e.g. /api/events)
        saleUnit,
        view,
        queryString,
        domain: domain || undefined, // domain for the link (e.g. dub.sh, stey.me, etc.)
        key: key ? decodeURIComponent(key) : undefined, // link key (e.g. github, weathergpt, etc.)
        url: dashboardProps?.url, // url for the link (only for public stats pages)
        folderId: folderId || undefined, // id of the folder(s) to filter by
        tagId, // ids of the tag(s) to filter by
        start, // start of time period
        end, // end of time period
        interval, /// time period interval
        totalEvents, // totalEvents (clicks, leads, sales)
        percentageChanges, // percentage changes from previous period
        totalEventsLoading: totalEventsLoading,
        adminPage, // whether the user is an admin
        showConversions, // whether to show conversions tabs/data
        fetchCompositeStats, // whether to pull composite stats or just clicks
        requiresUpgrade, // whether an upgrade is required to perform the query
        dashboardProps,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
