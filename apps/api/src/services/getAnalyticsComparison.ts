import { getClickHouseClient } from "../lib/clickhouse";
import { env } from "../lib/env";

const clickhouse = getClickHouseClient();
const DB = env.CLICKHOUSE_DB;

export interface AnalyticsData {
  current: {
    visitors: number;
    revenue: number;
    online: number;
    conversionrate: number;
    bouncerate: number;
    sessions: number;
  };
  previous: {
    visitors: number;
    revenue: number;
    online: number;
    conversionrate: number;
    bouncerate: number;
    sessions: number;
  };
}

/**
 * Get analytics metrics with comparison to previous period
 */
export async function getAnalyticsWithComparison({
  workspaceId,
  start,
  end,
}: {
  workspaceId: string;
  start: string;
  end: string;
}): Promise<AnalyticsData> {
  // Calculate previous period dates
  const startDate = new Date(start);
  const endDate = new Date(end);
  const periodMs = endDate.getTime() - startDate.getTime();

  const previousStartDate = new Date(startDate.getTime() - periodMs);
  const previousStart = previousStartDate.toISOString();
  const previousEnd = startDate.toISOString();

  // Query current period
  const currentResult = await clickhouse.query({
    query: `
      WITH
      sessions AS (
        SELECT COUNT(*) AS total
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen >= toDateTime({start:String})
        AND first_seen < toDateTime({end:String})
      ),
      bounced AS (
        SELECT COUNT(*) AS b
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND pageview_count = 1
        AND first_seen >= toDateTime({start:String})
        AND first_seen < toDateTime({end:String})
      ),
      conversions AS (
        SELECT COUNT(DISTINCT session_id) AS c
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND event_type = 'conversion'
        AND timestamp >= toDateTime({start:String})
        AND timestamp < toDateTime({end:String})
      ),
      visitors AS (
        SELECT COUNT(DISTINCT visitor_id) AS v
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp >= toDateTime({start:String})
        AND timestamp < toDateTime({end:String})
      ),
      revenue AS (
        SELECT COALESCE(SUM(toFloat64OrZero(props['revenue'])), 0) AS r
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp >= toDateTime({start:String})
        AND timestamp < toDateTime({end:String})
      ),
      session_time AS (
        SELECT COALESCE(AVG(dateDiff('second', first_seen, last_seen)), 0) AS st
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen >= toDateTime({start:String})
        AND first_seen < toDateTime({end:String})
      ),
      online AS (
        SELECT COUNT(*) AS o
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND last_seen >= now() - INTERVAL 5 MINUTE
      )

      SELECT
        COALESCE(visitors.v, 0) AS visitors,
        COALESCE(revenue.r, 0) AS revenue,
        COALESCE(online.o, 0) AS online,
        if(sessions.total = 0, 0, (conversions.c / sessions.total) * 100) AS conversionrate,
        if(sessions.total = 0, 0, (bounced.b / sessions.total) * 100) AS bouncerate,
        COALESCE(session_time.st, 0) AS sessions
      FROM sessions, bounced, conversions, visitors, revenue, session_time, online
    `,
    query_params: { workspaceId, start, end },
  });

  // Query previous period
  const previousResult = await clickhouse.query({
    query: `
      WITH
      sessions AS (
        SELECT COUNT(*) AS total
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen >= toDateTime({previousStart:String})
        AND first_seen < toDateTime({previousEnd:String})
      ),
      bounced AS (
        SELECT COUNT(*) AS b
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND pageview_count = 1
        AND first_seen >= toDateTime({previousStart:String})
        AND first_seen < toDateTime({previousEnd:String})
      ),
      conversions AS (
        SELECT COUNT(DISTINCT session_id) AS c
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND event_type = 'conversion'
        AND timestamp >= toDateTime({previousStart:String})
        AND timestamp < toDateTime({previousEnd:String})
      ),
      visitors AS (
        SELECT COUNT(DISTINCT visitor_id) AS v
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp >= toDateTime({previousStart:String})
        AND timestamp < toDateTime({previousEnd:String})
      ),
      revenue AS (
        SELECT COALESCE(SUM(toFloat64OrZero(props['revenue'])), 0) AS r
        FROM ${DB}.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp >= toDateTime({previousStart:String})
        AND timestamp < toDateTime({previousEnd:String})
      ),
      session_time AS (
        SELECT COALESCE(AVG(dateDiff('second', first_seen, last_seen)), 0) AS st
        FROM ${DB}.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen >= toDateTime({previousStart:String})
        AND first_seen < toDateTime({previousEnd:String})
      )

      SELECT
        COALESCE(visitors.v, 0) AS visitors,
        COALESCE(revenue.r, 0) AS revenue,
        0 AS online,
        if(sessions.total = 0, 0, (conversions.c / sessions.total) * 100) AS conversionrate,
        if(sessions.total = 0, 0, (bounced.b / sessions.total) * 100) AS bouncerate,
        COALESCE(session_time.st, 0) AS sessions
      FROM sessions, bounced, conversions, visitors, revenue, session_time
    `,
    query_params: { workspaceId, previousStart, previousEnd },
  });

  const currentData = (await currentResult.json()) as { data: any[] };
  const previousData = (await previousResult.json()) as { data: any[] };

  const currentMetrics = currentData.data[0] || {
    visitors: 0,
    revenue: 0,
    online: 0,
    conversionrate: 0,
    bouncerate: 0,
    sessions: 0,
  };

  const previousMetrics = previousData.data[0] || {
    visitors: 0,
    revenue: 0,
    online: 0,
    conversionrate: 0,
    bouncerate: 0,
    sessions: 0,
  };

  return {
    current: currentMetrics,
    previous: previousMetrics,
  };
}
