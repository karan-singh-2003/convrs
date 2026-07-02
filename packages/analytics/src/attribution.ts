// packages/analytics/src/services/attribution.service.ts
// import { prisma } from "@repo/db";

export interface AttributionResult {
  attributed: boolean;
  visitorId: string;
  sessionId?: string;
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

/**
 * Attempts to attribute a payment to a known visitor session.
 *
 * Attribution succeeds when:
 *   1. visitorId is present in the Stripe metadata, AND
 *   2. That visitor has at least one prior pageview in Tinybird for this workspace.
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
    return { attributed: false, visitorId: "", enrichedContext: null };
  }

  const tinybirdApiUrl = process.env.TINYBIRDS_API_URL;
  const tinybirdApiKey = process.env.TINYBIRDS_API_KEY;

  if (!tinybirdApiUrl || !tinybirdApiKey) {
    console.warn("[attribution] Missing Tinybird credentials — cannot verify visitor");
    return { attributed: false, visitorId, enrichedContext: null };
  }

  try {
    // Query Tinybird for the visitor's most recent session context.
    // We use the customer_events endpoint which filters by workspaceId + visitorId.
    const params = new URLSearchParams({
      workspaceId,
      visitorId,
      limit: "1",
    });

    const response = await fetch(
      `${tinybirdApiUrl}/v0/pipes/v1_customer_attribution.json?${params}`,
      {
        headers: { Authorization: `Bearer ${tinybirdApiKey}` },
      }
    );

    if (!response.ok) {
      console.error("[attribution] Tinybird query failed", response.status);
      return { attributed: false, visitorId, enrichedContext: null };
    }

    const data = await response.json();
    const rows: any[] = data?.data ?? [];

    if (rows.length === 0) {
      // Visitor exists in metadata but has no recorded events — unattributed
      return { attributed: false, visitorId, enrichedContext: null };
    }

    const row = rows[0];

    return {
      attributed: true,
      visitorId,
      sessionId,
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
  } catch (err) {
    console.error("[attribution] Unexpected error", err);
    return { attributed: false, visitorId, enrichedContext: null };
  }
}
