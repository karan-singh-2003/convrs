import { test, expect } from "@playwright/test";
import { createTrackingWorkspace, randomToken } from "../fixtures/seed";
import { TINYBIRDS_API_URL, TINYBIRDS_API_KEY } from "../fixtures/env";

// Tagged @tinybird and isolated into its own Playwright project (see
// utm-attribution.tinybird.spec.ts for the same pattern/rationale) — this
// suite talks to real Tinybird directly, not through /api/track, because the
// one thing it needs to prove (a bot=1 row never affecting the revenue KPI)
// can't be produced through the app at all: recordEvent() never sends a
// bot=1 row to Tinybird in the first place (packages/analytics/src/
// record-event.ts drops bot events before they're ever stored). So this test
// inserts directly into the landing datasource to simulate the one scenario
// the audit flagged as a fragile, untested invariant: v1_count.pipe's
// count_revenue node used to read the raw dub_click_events table with no
// `bot = 0` filter, silently relying on that upstream invariant holding
// forever. Run explicitly via `pnpm test:tinybird`.

async function isTinybirdReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${TINYBIRDS_API_URL}/v0/pipes`, {
      headers: { Authorization: `Bearer ${TINYBIRDS_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Minimal but complete dub_click_events row — mirrors the field set
// record-event.ts's eventData actually sends, so this exercises the exact
// same schema/materialization path a real event would.
function buildRevenueRow(opts: {
  workspaceId: string;
  revenue: number;
  bot: 0 | 1;
}) {
  return {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event_type: "revenue",
    event_name: "payment",

    workspace_id: opts.workspaceId,
    visitor_id: randomToken("vid"),
    session_id: null,
    identity_hash: null,
    user_id: null,

    revenue: opts.revenue,
    currency: "USD",

    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,

    url: "https://example.com/checkout",
    hostname: "example.com",
    page: "/checkout",
    entrypage: null,
    exitlink: null,
    referer: "(direct)",
    referer_url: "(direct)",

    country: "US",
    city: "Unknown",
    region: "Unknown",
    continent: "NA",
    latitude: "Unknown",
    longitude: "Unknown",

    device: "Desktop",
    device_model: "Unknown",
    device_vendor: "Unknown",
    browser: "Unknown",
    browser_version: "Unknown",
    os: "Unknown",
    os_version: "Unknown",
    engine: "Unknown",
    engine_version: "Unknown",
    cpu_architecture: "Unknown",
    ua: opts.bot === 1 ? "SomeCrawlerBot/1.0" : "Mozilla/5.0 (test)",

    bot: opts.bot,
    ip: null,
    vercel_region: null,
    qr: 0,
    trigger: "payment",

    event_properties: "{}",
  };
}

async function insertEvent(row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${TINYBIRDS_API_URL}/v0/events?name=dub_click_events&wait=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TINYBIRDS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(row),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body as any).error) {
    throw new Error(`Tinybird insert failed: ${res.status} ${JSON.stringify(body)}`);
  }
}

async function queryRevenue(workspaceId: string): Promise<number | null> {
  const params = new URLSearchParams({ workspaceId, eventType: "revenue" });
  const res = await fetch(`${TINYBIRDS_API_URL}/v0/pipes/v1_count.json?${params}`, {
    headers: { Authorization: `Bearer ${TINYBIRDS_API_KEY}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  const row = (body?.data ?? [])[0];
  return row ? Number(row.revenue) : null;
}

test.describe("revenue KPI excludes bot rows @tinybird", () => {
  test.beforeAll(async () => {
    const reachable = await isTinybirdReachable();
    test.skip(
      !reachable,
      `Local Tinybird (${TINYBIRDS_API_URL}) is not reachable — this environment has no local Tinybird instance running. ` +
        "This is an environmental gap, not an application failure; see the e2e README."
    );
  });

  test("a bot=1 revenue row never contributes to v1_count's revenue KPI", async () => {
    const ws = await createTrackingWorkspace("bot-revenue");

    // Legit, non-bot revenue — this is what the KPI SHOULD reflect.
    const legitAmount = 7;
    // Fabricated bot revenue — orders of magnitude larger so any leak is
    // impossible to miss (not a rounding-error-sized false pass).
    const botAmount = 99999;

    await insertEvent(buildRevenueRow({ workspaceId: ws.id, revenue: legitAmount, bot: 0 }));
    await insertEvent(buildRevenueRow({ workspaceId: ws.id, revenue: botAmount, bot: 1 }));

    // Poll until the legit row has landed and is queryable — once it has,
    // assert immediately (not "poll until revenue === legitAmount", which
    // would also just time out silently if the fix regressed and the total
    // included the bot row instead of failing fast).
    await expect
      .poll(() => queryRevenue(ws.id), {
        message: "waiting for the revenue event to become queryable in Tinybird",
        timeout: 20_000,
        intervals: [1000, 2000, 3000],
      })
      .not.toBeNull();

    const revenue = await queryRevenue(ws.id);
    expect(revenue).toBe(legitAmount);
  });
});
