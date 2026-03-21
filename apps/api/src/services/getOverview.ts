import { getClickHouseClient } from "../lib/clickhouse";

const clickhouse = getClickHouseClient();

export async function getOverview({
  workspaceId,
  start,
  end,
}: {
  workspaceId: string;
  start: string;
  end: string;
}) {
  const result = await clickhouse.query({
    query: `
      WITH
      sessions AS (
        SELECT COUNT(*) AS total
        FROM analytics.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      bounced AS (
        SELECT COUNT(*) AS b
        FROM analytics.sessions
        WHERE workspace_id = {workspaceId:String}
        AND pageview_count = 1
        AND first_seen BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      conversions AS (
        SELECT COUNT(DISTINCT session_id) AS c
        FROM analytics.events
        WHERE workspace_id = {workspaceId:String}
        AND event_type = 'conversion'
        AND timestamp BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      visitors AS (
        SELECT COUNT(DISTINCT visitor_id) AS v
        FROM analytics.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      revenue AS (
        SELECT SUM(toFloat64OrZero(props['revenue'])) AS r
        FROM analytics.events
        WHERE workspace_id = {workspaceId:String}
        AND timestamp BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      session_time AS (
        SELECT AVG(dateDiff('second', first_seen, last_seen)) AS st
        FROM analytics.sessions
        WHERE workspace_id = {workspaceId:String}
        AND first_seen BETWEEN {start:DateTime} AND {end:DateTime}
      ),
      online AS (
        SELECT COUNT(*) AS o
        FROM analytics.sessions
        WHERE workspace_id = {workspaceId:String}
        AND last_seen >= now() - INTERVAL 5 MINUTE
      )

      SELECT
        visitors.v AS visitors,
        revenue.r AS revenue,
        online.o AS online,
        if(sessions.total = 0, 0, (conversions.c / sessions.total) * 100) AS conversion,
        if(sessions.total = 0, 0, (bounced.b / sessions.total) * 100) AS bounceRate,
        session_time.st AS sessionTime
      FROM sessions, bounced, conversions, visitors, revenue, session_time, online
    `,
    query_params: { workspaceId, start, end },
  });

  const data = (await result.json()) as { data: any[] };
  return data.data[0];
}
