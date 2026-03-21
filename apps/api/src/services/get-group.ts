import { getClickHouseClient } from "../lib/clickhouse";

const clickhouse = getClickHouseClient();

const groupByMap: Record<string, string> = {
  country: "country",
  countries: "country",
  city: "city",
  cities: "city",
  region: "region",
  regions: "region",
  browsers: "browser",
  browser: "browser",
  hostname: "hostname",
  url: "url",
  referrer: "referrer",
};

export async function getGroup({
  workspaceId,
  start,
  end,
  groupBy,
}: {
  workspaceId: string;
  start: string;
  end: string;
  groupBy: string;
}) {
  const column = groupByMap[groupBy];

  if (!column) throw new Error("Invalid groupBy");

  const result = await clickhouse.query({
    query: `
      SELECT
        ${column} AS label,
        COUNT(*) AS value
      FROM analytics.events
      WHERE workspace_id = {workspaceId:String}
      AND timestamp BETWEEN {start:DateTime} AND {end:DateTime}
      GROUP BY ${column}
      ORDER BY value DESC
      LIMIT 20
    `,
    query_params: { workspaceId, start, end },
  });

  const data = await result.json();
  return data.data;
}
