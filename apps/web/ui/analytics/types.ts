import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { z } from "zod";
export type EventType =
  | "visitors"
  | "revenue"
  | "conversionRate"
  | "bounceRate"
  | "sessions"
  | "online";

export type GroupByType =
  | "country"
  | "device"
  | "browser"
  | "os"
  | "city"
  | "source"
  | "page"
  | "referrer"
  | "campaign"
  | "keyword"
  | "regions"
  | "continents";

export const Valid_Analytics_Endpoints = [
  "count",
  "country",
  "device",
  "browser",
  "os",
  "city",
  "source",
  "page",
  "referrer",
  "campaign",
  "keyword",
  "regions",
  "continents",
] as const;

type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type AnalyticsFilters = Override<
  z.infer<typeof analyticsQuerySchema>,
  {
    workspaceId: string;
    timezone?: string;
  }
>;
