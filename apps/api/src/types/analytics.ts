/**
 * types/analytics.ts
 *
 * Shared type definitions for analytics queries and responses.
 */

export interface AnalyticsQuery {
  workspaceId: string;
  start: string; // ISO date
  end: string; // ISO date
  interval?: "day" | "week" | "month";
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  page?: string;
  event?: string;
}

export interface MetricsOverview {
  visitors: number;
  sessions: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
  avgSessionTime: number;
  onlineUsers: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  visitors: number;
  sessions: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
  avgSessionTime: number;
}

export interface AnalyticsResponse {
  current: MetricsOverview;
  previous: MetricsOverview;
  timeseries: TimeseriesPoint[];
}

export interface GroupedItem {
  value: string;
  code?: string;
  country?: string;
  count: number;
  revenue?: number;
  conversionRate?: number;
}

export interface GroupedAnalyticsResponse {
  items: GroupedItem[];
  total: number;
}

export type GroupByType =
  | "country"
  | "city"
  | "region"
  | "continent"
  | "device"
  | "browser"
  | "os"
  | "referrer"
  | "page"
  | "channel"
  | "campaign"
  | "keyword"
  | "source";

// API Key info resolved from token
export interface ApiKeyInfo {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
}
