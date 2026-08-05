type ShortLinkReferer = {
  workspace_id: string;
  visitor_id: string;
  event_id: string;
  referer_url: string;
  timestamp: string;
};

/**
 * Ad-hoc SQL against Tinybird rather than a dedicated pipe — this is a
 * narrow, infrequent internal query (workers only), not a user-facing
 * dashboard endpoint, so skipping a pipe deploy keeps this simple. If
 * this query needs to scale further, promote it to a proper .pipe.
 */
export async function getRecentShortLinkReferers(
  sinceMinutes: number
): Promise<ShortLinkReferer[]> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) throw new Error("Missing Tinybird credentials");

  const sql = `
    SELECT DISTINCT
      workspace_id,
      visitor_id,
      event_id,
      referer_url,
      timestamp
    FROM dub_click_events
    WHERE
      bot = 0
      AND (referer = 't.co' OR referer LIKE '%x.com%' OR referer LIKE '%twitter.com%')
      AND timestamp >= now() - INTERVAL ${sinceMinutes} MINUTE
    ORDER BY timestamp DESC
    LIMIT 2000
    FORMAT JSON
  `;
 
  const response = await fetch(`${apiUrl}/v0/sql?q=${encodeURIComponent(sql)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
 

  if (!response.ok) {
    throw new Error(`Tinybird query error ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  return body.data ?? [];
}