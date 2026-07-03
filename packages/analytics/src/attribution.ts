// packages/analytics/src/services/attribution.service.ts
// import { prisma } from "@repo/db";

export interface AttributionResult {
  attributed: boolean;
  visitorId: string;
  sessionId?: string;
  // true when attribution failed because the visitor's session data
  // hasn't landed in Tinybird yet (ingestion lag) — caller should
  // treat this as "pending, retry later" rather than a hard failure.
  retryable: boolean;
  // context enriched from Tinybird for the Tinybird event payload
  enrichedContext: {
    country: string;
    city: string;
    region: string;
    continent: string;
    device: string;
    browser: string;
    os: string;
    referer: string;
    referer_url: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    url: string;
    page: string | null;
  } | null;
}

const RETRY_DELAYS_MS = [300, 700, 1500]; // ~2.5s total worst case

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queries Tinybird once for the visitor's most recent session context.
 * Returns null rows / not-ok as a signal to the caller — does not retry itself.
 */
async function queryAttribution({
  tinybirdApiUrl,
  tinybirdApiKey,
  workspaceId,
  visitorId,
}: {
  tinybirdApiUrl: string;
  tinybirdApiKey: string;
  workspaceId: string;
  visitorId: string;
}): Promise<{ ok: boolean; rows: any[] }> {
  const params = new URLSearchParams({ workspaceId, visitorId, limit: "1" });

  const response = await fetch(
    `${tinybirdApiUrl}/v0/pipes/v1_customer_attribution.json?${params}`,
    { headers: { Authorization: `Bearer ${tinybirdApiKey}` } }
  );

  if (!response.ok) {
    console.error("[attribution] Tinybird query failed", response.status);
    return { ok: false, rows: [] };
  }

  const data = await response.json();
  return { ok: true, rows: data?.data ?? [] };
}

/**
 * Attempts to attribute a payment to a known visitor session.
 *
 * Attribution succeeds when:
 *   1. visitorId is present in the Stripe metadata, AND
 *   2. That visitor has at least one prior pageview in Tinybird for this workspace.
 *
 * Because the visitor's pageview and the Stripe webhook can race (webhook
 * arrives before the pageview finishes propagating through Tinybird's
 * ingest + materialized view), this makes a few fast attempts before
 * giving up. If it still finds nothing, it returns retryable: true so a
 * background reconciliation job can try again later instead of the
 * payment being marked permanently unattributed off one lucky/unlucky query.
 *
 * On success we return the enriched session context so the Tinybird revenue
 * event gets proper UTM / geo / device data (mirroring what the MV pipe does
 * for revenue events via the session/visitor join).
 */
export async function attemptAttribution({
  workspaceId,
  visitorId,
  sessionId,
}: {
  workspaceId: string;
  visitorId: string | undefined;
  sessionId: string | undefined;
}): Promise<AttributionResult> {
  if (!visitorId) {
    // No visitor id at all — nothing to look up, ever. Not retryable.
    return { attributed: false, visitorId: "", retryable: false, enrichedContext: null };
  }

  const tinybirdApiUrl = process.env.TINYBIRDS_API_URL;
  const tinybirdApiKey = process.env.TINYBIRDS_API_KEY;

  if (!tinybirdApiUrl || !tinybirdApiKey) {
    console.warn("[attribution] Missing Tinybird credentials — cannot verify visitor");
    // Config problem, not a data-timing problem — still worth retrying later
    // in case env gets fixed, but don't spin on it synchronously.
    return { attributed: false, visitorId, retryable: true, enrichedContext: null };
  }

  let lastOk = false;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { ok, rows } = await queryAttribution({
        tinybirdApiUrl,
        tinybirdApiKey,
        workspaceId,
        visitorId,
      });
      lastOk = ok;

      if (ok && rows.length > 0) {
        const row = rows[0];
        return {
          attributed: true,
          visitorId,
          sessionId,
          retryable: false,
          enrichedContext: {
            country: row.country ?? "Unknown",
            city: row.city ?? "Unknown",
            region: row.region ?? "Unknown",
            continent: row.continent ?? "Unknown",
            device: row.device ?? "Unknown",
            browser: row.browser ?? "Unknown",
            os: row.os ?? "Unknown",
            referer: row.referer ?? "(direct)",
            referer_url: row.referer_url ?? "(direct)",
            utm_source: row.utm_source ?? null,
            utm_medium: row.utm_medium ?? null,
            utm_campaign: row.utm_campaign ?? null,
            utm_content: row.utm_content ?? null,
            utm_term: row.utm_term ?? null,
            url: row.url ?? "",
            page: row.page ?? null,
          },
        };
      }
    } catch (err) {
      console.error("[attribution] Unexpected error", err);
      lastOk = false;
    }

    // Not found yet (or errored) — wait briefly and try again, unless this
    // was the last attempt.
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  // Exhausted fast retries with nothing found. This is very likely an
  // ingestion-lag race rather than a truly unattributable visitor, so mark
  // it retryable — a background job should attempt this again in a few
  // minutes rather than writing it off now.
  return { attributed: false, visitorId, retryable: lastOk, enrichedContext: null };
}