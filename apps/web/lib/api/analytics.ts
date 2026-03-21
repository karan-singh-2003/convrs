/**
 * lib/api/analytics.ts
 *
 * Frontend client utilities for analytics API.
 * Handles request building and serialization.
 */

export interface AnalyticsParams {
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

export interface GroupAnalyticsParams extends AnalyticsParams {
  groupBy:
    | "country"
    | "city"
    | "region"
    | "device"
    | "browser"
    | "os"
    | "referrer"
    | "page";
  limit?: number;
}

/**
 * buildAnalyticsUrl
 *
 * Constructs query string from analytics params.
 * Usage: const url = buildAnalyticsUrl({ start, end, interval }, workspaceId)
 */
export function buildAnalyticsUrl(
  params: AnalyticsParams,
  workspaceId: string
): string {
  const query = new URLSearchParams();

  query.set("start", params.start);
  query.set("end", params.end);

  if (params.interval) query.set("interval", params.interval);
  if (params.country) query.set("country", params.country);
  if (params.device) query.set("device", params.device);
  if (params.browser) query.set("browser", params.browser);
  if (params.os) query.set("os", params.os);
  if (params.referrer) query.set("referrer", params.referrer);
  if (params.page) query.set("page", params.page);
  if (params.event) query.set("event", params.event);

  return `/api/workspaces/${workspaceId}/analytics?${query.toString()}`;
}

/**
 * buildGroupAnalyticsUrl
 *
 * Constructs query string from group analytics params.
 * Usage: const url = buildGroupAnalyticsUrl({ start, end, groupBy: "country" }, workspaceId)
 */
export function buildGroupAnalyticsUrl(
  params: GroupAnalyticsParams,
  workspaceId: string
): string {
  const query = new URLSearchParams();

  query.set("start", params.start);
  query.set("end", params.end);
  query.set("groupBy", params.groupBy);

  if (params.country) query.set("country", params.country);
  if (params.device) query.set("device", params.device);
  if (params.browser) query.set("browser", params.browser);
  if (params.os) query.set("os", params.os);
  if (params.referrer) query.set("referrer", params.referrer);
  if (params.page) query.set("page", params.page);
  if (params.event) query.set("event", params.event);
  if (params.limit) query.set("limit", params.limit.toString());

  return `/api/workspaces/${workspaceId}/analytics/group?${query.toString()}`;
}
