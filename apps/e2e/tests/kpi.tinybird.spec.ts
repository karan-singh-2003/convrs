import { test, expect, type Page, type Locator } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createStripeIntegration, randomToken } from "../fixtures/seed";
import { USERS } from "../fixtures/seed-data";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import {
  signStripePayload,
  buildCheckoutSessionCompletedPayload,
} from "../fixtures/stripe-signature";
import {
  INGEST_BASE_URL,
  STRIPE_WEBHOOK_SECRET,
  TINYBIRDS_API_URL,
  TINYBIRDS_API_KEY,
} from "../fixtures/env";

// End-to-end audit of the dashboard KPI (Revenue / MRR / Goal) through the
// real web + ingestion servers, real Postgres and real (local) Tinybird:
// pageviews and goal events go through /api/track, revenue through a signed
// Stripe webhook, and MRR from CustomerSubscription rows (its source of
// truth). Every assertion checks both the semantic label and the formatted
// value, so a stale "Revenue"/"$" surviving a switch to a Goal KPI fails.

const RATES = { INR: 83, EUR: 0.9, GBP: 0.8 } as const;

// Fixture: 3 visitors, 2 "signup" goals, 1 "trial_started" goal, one $99.00
// attributed payment, and two active subscriptions:
//   $29.00 / month (USD)  +  €120.00 / year (EUR, i.e. €10.00 / month)
const VISITORS = 3;
const REVENUE_USD = 99;
const MRR_USD = 29 + 10 / RATES.EUR; // 40.111…

// Anything that would mean revenue leaked into a Goal KPI's tooltip:
// "Revenue" (also covers "Revenue/visitor"), "MRR", or a currency symbol.
const REVENUE_OR_CURRENCY = /Revenue|MRR|[$₹€£]/;

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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

async function tinybirdCount(sql: string): Promise<number> {
  const res = await fetch(
    `${TINYBIRDS_API_URL}/v0/sql?q=${encodeURIComponent(`${sql} FORMAT JSON`)}`,
    { headers: { Authorization: `Bearer ${TINYBIRDS_API_KEY}` } }
  );
  if (!res.ok) return -1;
  const body = await res.json();
  return Number(Object.values(body?.data?.[0] ?? { c: 0 })[0]);
}

/** The KPI tab card whose label is exactly `label`. */
function kpiTab(page: Page, label: string): Locator {
  return page
    .locator("div.relative.z-0", { has: page.locator(`span[title="${label}"]`) })
    .first();
}

/**
 * The value a KPI tab actually displays. NumberFlow's DOM text is its
 * animated digit columns ("$0123456789…"), not the rendered number; the
 * complete formatted value is exposed as the element's accessible name
 * (role="img", aria-label = valueAsString via ElementInternals), which only
 * the browser's real accessibility tree reports.
 */
async function kpiValue(page: Page, label: string): Promise<string | null> {
  const handle = await kpiTab(page, label).locator("number-flow-react").first().elementHandle();
  if (!handle) return null;
  const node = await page.accessibility.snapshot({ root: handle, interestingOnly: false });
  return node?.name ?? null;
}

async function expectKpiValue(page: Page, label: string, expected: string) {
  await expect
    .poll(() => kpiValue(page, label), { message: `"${label}" KPI tab value` })
    .toBe(expected);
}

/**
 * Hovers today's bucket of the dashboard's area chart (where all the seeded
 * data lives) and returns its tooltip. The hover target is the chart's
 * transparent overlay <rect> (it owns onMouseMove/onMouseLeave), which sits
 * inside the chart margins. The rightmost bucket isn't necessarily today (the
 * 7d range can end in an empty trailing bucket), so sweep right-to-left until
 * the tooltip's date label is today's, formatted the way formatDateTooltip
 * does in the browser's own timezone.
 */
async function hoverLatestChartPoint(page: Page): Promise<Locator> {
  const chart = page.locator('div[class*="h-[444px]"]').first();
  const overlay = chart.locator('svg rect[fill="transparent"]').last();
  await expect(overlay).toBeVisible();
  const box = (await overlay.boundingBox())!;
  const tooltip = chart.locator("div.pointer-events-none.rounded-2xl");
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  );
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(box.x + box.width - 2 - (i * box.width) / 60, y);
    await page.waitForTimeout(50);
    const text = (await tooltip.isVisible()) ? await tooltip.innerText() : "";
    if (text.startsWith(today)) return tooltip;
  }
  throw new Error(`No chart tooltip for today's bucket ("${today}") found while sweeping the chart`);
}

/**
 * The goal dropdown trigger in Settings → KPI. Its label is whichever goal is
 * currently selected (the first tracked goal by default), so locate it by its
 * chevron rather than by text.
 */
function goalPicker(page: Page): Locator {
  return page
    .locator("div.rounded-xl", { hasText: "What's the most important metric" })
    .last()
    .locator("button", { has: page.locator("svg.lucide-chevron-down") });
}

/** Hovers the "example.com" row in the Pages card and returns its tooltip. */
async function hoverPagesBarRow(page: Page): Promise<Locator> {
  await page.mouse.move(0, 0);
  const row = page.getByText("example.com", { exact: true }).first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const tooltip = page.locator("div.z-50.rounded-xl", { hasText: "example.com" }).last();
  await expect(tooltip).toBeVisible();
  return tooltip;
}

test.describe("Dashboard KPI: Revenue / MRR / Goal @tinybird", () => {
  // Parallel-safe: beforeAll runs once per worker and seeds that worker's own
  // workspace, so workers never share KPI/currency state. Within a worker,
  // each test sets the KPI it needs and beforeEach resets the currency, so no
  // test depends on another's outcome (a failure restarts the worker, which
  // reseeds a fresh workspace).
  test.use({ storageState: ".auth/owner.json" });
  test.setTimeout(240_000);

  let slug: string;
  let workspaceId: string;

  async function setKpi(page: Page, body: Record<string, unknown>) {
    const res = await page.request.patch(`/api/workspaces/${slug}/kpi`, { data: body });
    expect(res.ok()).toBe(true);
  }

  async function setCurrency(page: Page, currency: string) {
    // Same endpoint the Revenue settings page saves through (it accepts the
    // slug or the ws_-prefixed id, not the raw database id).
    const res = await page.request.patch(`/api/workspaces/${slug}`, {
      data: { currency },
    });
    expect(res.ok()).toBe(true);
  }

  async function openDashboard(page: Page, event: string) {
    await page.goto(`/${slug}?event=${event}&interval=7d`);
    await expect(page.locator('span[title="Visitors"]').first()).toBeVisible({
      timeout: 60_000,
    });
  }

  test.beforeEach(async ({ page }) => {
    await setCurrency(page, "USD");
  });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000);
    test.skip(
      !(await isTinybirdReachable()),
      `Local Tinybird (${TINYBIRDS_API_URL}) is not reachable — environmental gap, not an app failure.`
    );

    slug = randomToken("e2e-kpi").toLowerCase();
    const ws = await prisma.workspace.create({
      data: {
        name: `KPI audit ${slug}`,
        slug,
        plan: "business",
        subscriptionStatus: "active",
        projectToken: randomToken("proj"),
        currency: "USD",
        kpiType: "revenue",
        kpiRevenueMetric: "revenue",
      },
    });
    workspaceId = ws.id;
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: USERS.owner.email } });
    await prisma.workspaceUsers.create({
      data: { workspaceId, userId: owner.id, role: "owner" },
    });
    await createStripeIntegration(workspaceId, STRIPE_WEBHOOK_SECRET);

    // USD-based rates, as update-rates.ts stores them. Several workers seed
    // concurrently with identical values, so insert-if-absent.
    await prisma.exchangeRate.createMany({
      data: Object.entries(RATES).map(([target, rate]) => ({
        baseCurrency: "USD",
        targetCurrency: target,
        rate,
      })),
      skipDuplicates: true,
    });

    // ── Traffic + goals through the real ingestion endpoint ────────────────
    const visitors = Array.from({ length: VISITORS }, () => randomToken("vid"));
    const goals: Array<[string, string]> = [
      [visitors[0], "signup"],
      [visitors[1], "signup"],
      [visitors[2], "trial_started"],
    ];
    for (const visitorId of visitors) {
      const res = await request.post(`${INGEST_BASE_URL}/api/track`, {
        headers: { "user-agent": REAL_CHROME_UA },
        data: { ...buildPageviewPayload({ websiteId: ws.projectToken! }), visitorId },
      });
      expect(res.ok()).toBe(true);
    }
    for (const [visitorId, eventName] of goals) {
      const res = await request.post(`${INGEST_BASE_URL}/api/track`, {
        headers: { "user-agent": REAL_CHROME_UA },
        data: {
          ...buildPageviewPayload({ websiteId: ws.projectToken! }),
          visitorId,
          type: "custom",
          event_name: eventName,
        },
      });
      expect(res.ok()).toBe(true);
    }

    await expect
      .poll(
        () =>
          tinybirdCount(
            `SELECT count() FROM dub_click_events_mv WHERE workspace_id = '${workspaceId}'`
          ),
        { message: "waiting for pageviews + goals in Tinybird", timeout: 30_000 }
      )
      .toBe(6);

    // ── One attributed $99.00 payment through the real Stripe webhook ──────
    const eventId = randomToken("evt");
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: randomToken("cs"),
      eventId,
      amountTotal: REVENUE_USD * 100,
      currency: "usd",
      customerEmail: `kpi-payer-${slug}@example.com`,
      visitorId: visitors[0],
    });
    const { signatureHeader } = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);
    const webhook = await request.post(`${INGEST_BASE_URL}/api/stripe/webhook/${workspaceId}`, {
      headers: { "content-type": "application/json", "stripe-signature": signatureHeader },
      data: payload,
    });
    expect(webhook.ok()).toBe(true);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { provider_externalEventId: { provider: "stripe", externalEventId: eventId } },
    });
    expect(payment.attributionStatus).toBe("attributed");
    await expect
      .poll(
        () =>
          tinybirdCount(
            `SELECT sum(revenue) FROM dub_click_events_mv WHERE workspace_id = '${workspaceId}' AND event_type = 'revenue'`
          ),
        { message: "waiting for revenue in Tinybird", timeout: 30_000 }
      )
      .toBe(REVENUE_USD);

    // ── MRR source of truth: two active subscriptions (amounts in cents) ───
    const customer = await prisma.customer.create({
      data: { workspaceId, email: `kpi-sub-${slug}@example.com` },
    });
    const startedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await prisma.customerSubscription.createMany({
      data: [
        {
          workspaceId,
          customerId: customer.id,
          provider: "stripe",
          externalId: randomToken("sub"),
          status: "active",
          amount: 2900,
          currency: "usd",
          interval: "month",
          startedAt,
        },
        {
          workspaceId,
          customerId: customer.id,
          provider: "stripe",
          externalId: randomToken("sub"),
          status: "active",
          amount: 12000,
          currency: "eur",
          interval: "year",
          startedAt,
        },
      ],
    });
  });

  test("Revenue KPI: tab, area-chart tooltip and bar-list tooltip show revenue in USD", async ({
    page,
  }) => {
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });
    await openDashboard(page, "revenue");

    await expectKpiValue(page, "Revenue", money(REVENUE_USD, "USD"));
    await expect(page.locator('span[title="MRR"]')).toHaveCount(0);

    const chartTooltip = await hoverLatestChartPoint(page);
    await expect(chartTooltip).toContainText("Revenue");
    await expect(chartTooltip).toContainText(money(REVENUE_USD, "USD"));

    // Per-row revenue comes from the revenue breakdown (group_by_sales), which
    // backs the bar lists on the Revenue tab; the Visitors-tab breakdown
    // (group_by_clicks) carries no revenue column.
    const barTooltip = await hoverPagesBarRow(page);
    await expect(barTooltip).toContainText("Revenue");
    await expect(barTooltip).toContainText(money(REVENUE_USD, "USD"));
  });

  test("Revenue → MRR: label, value and tooltip switch to MRR; refresh preserves it", async ({
    page,
  }) => {
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });
    await openDashboard(page, "revenue");
    await expectKpiValue(page, "Revenue", money(REVENUE_USD, "USD"));

    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "mrr" });
    await openDashboard(page, "revenue");

    await expect(page.locator('span[title="Revenue"]')).toHaveCount(0);
    await expectKpiValue(page, "MRR", money(MRR_USD, "USD"));

    const chartTooltip = await hoverLatestChartPoint(page);
    await expect(chartTooltip).toContainText("MRR");
    await expect(chartTooltip).not.toContainText("Revenue");
    await expect(chartTooltip).toContainText(money(MRR_USD, "USD"));

    await page.reload();
    await expectKpiValue(page, "MRR", money(MRR_USD, "USD"));
  });

  test("MRR → Revenue restores revenue", async ({ page }) => {
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "mrr" });
    await openDashboard(page, "revenue");
    await expectKpiValue(page, "MRR", money(MRR_USD, "USD"));

    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });
    await openDashboard(page, "revenue");
    await expect(page.locator('span[title="MRR"]')).toHaveCount(0);
    await expectKpiValue(page, "Revenue", money(REVENUE_USD, "USD"));
    const chartTooltip = await hoverLatestChartPoint(page);
    await expect(chartTooltip).toContainText(money(REVENUE_USD, "USD"));
    await expect(chartTooltip).not.toContainText("MRR");
  });

  for (const from of ["revenue", "mrr"] as const) {
    test(`${from === "mrr" ? "MRR" : "Revenue"} → Goal: every tooltip is goal-specific with no revenue or currency`, async ({
      page,
    }) => {
      await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: from });
      await openDashboard(page, "revenue");
      await expect(kpiTab(page, from === "mrr" ? "MRR" : "Revenue")).toBeVisible();

      await setKpi(page, { kpiType: "goal", kpiEventName: "signup" });
      await openDashboard(page, "revenue");

      await expectKpiValue(page, "signup", "2");
      await expect(page.locator('span[title="Revenue"]')).toHaveCount(0);
      await expect(page.locator('span[title="MRR"]')).toHaveCount(0);
      await expect(page.locator('span[title="Revenue/visitor"]')).toHaveCount(0);

      // KPI-series tooltip: the selected goal and its count, nothing else.
      const kpiTooltip = await hoverLatestChartPoint(page);
      await expect(kpiTooltip).toContainText(/signup\s*2(?!\d)/);
      await expect(kpiTooltip).not.toContainText(REVENUE_OR_CURRENCY);

      // Visitors tooltip shows the KPI row too — it must be the goal.
      await openDashboard(page, "clicks");
      const clicksTooltip = await hoverLatestChartPoint(page);
      await expect(clicksTooltip).toContainText(/signup\s*2(?!\d)/);
      await expect(clicksTooltip).not.toContainText(REVENUE_OR_CURRENCY);

      const barTooltip = await hoverPagesBarRow(page);
      await expect(barTooltip).toContainText("signup");
      await expect(barTooltip).not.toContainText(REVENUE_OR_CURRENCY);
    });
  }

  test("Goal A → Goal B swaps the goal data; refresh preserves the selection", async ({ page }) => {
    await setKpi(page, { kpiType: "goal", kpiEventName: "signup" });
    await openDashboard(page, "revenue");
    await expectKpiValue(page, "signup", "2");

    await setKpi(page, { kpiType: "goal", kpiEventName: "trial_started" });
    await openDashboard(page, "revenue");
    await expect(page.locator('span[title="signup"]')).toHaveCount(0);
    await expectKpiValue(page, "trial_started", "1");
    const tooltip = await hoverLatestChartPoint(page);
    await expect(tooltip).toContainText(/trial_started\s*1(?!\d)/);
    await expect(tooltip).not.toContainText("signup");
    await expect(tooltip).not.toContainText(REVENUE_OR_CURRENCY);

    await page.reload();
    await expectKpiValue(page, "trial_started", "1");
  });

  test("Goal KPI ignores workspace currency", async ({ page }) => {
    await setKpi(page, { kpiType: "goal", kpiEventName: "signup" });
    await setCurrency(page, "INR");
    await openDashboard(page, "revenue");
    await expectKpiValue(page, "signup", "2");
    const tooltip = await hoverLatestChartPoint(page);
    await expect(tooltip).toContainText(/signup\s*2(?!\d)/);
    await expect(tooltip).not.toContainText(REVENUE_OR_CURRENCY);
  });

  for (const to of ["revenue", "mrr"] as const) {
    test(`Goal → ${to === "mrr" ? "MRR" : "Revenue"} restores the revenue metric`, async ({ page }) => {
      await setKpi(page, { kpiType: "goal", kpiEventName: "signup" });
      await openDashboard(page, "revenue");
      await expectKpiValue(page, "signup", "2");

      await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: to });
      await openDashboard(page, "revenue");
      await expect(page.locator('span[title="signup"]')).toHaveCount(0);
      const label = to === "mrr" ? "MRR" : "Revenue";
      const expected = money(to === "mrr" ? MRR_USD : REVENUE_USD, "USD");
      await expectKpiValue(page, label, expected);
      const tooltip = await hoverLatestChartPoint(page);
      await expect(tooltip).toContainText(label);
      await expect(tooltip).toContainText(expected);
      await expect(tooltip).not.toContainText("signup");
    });
  }

  for (const currency of ["INR", "EUR", "GBP"] as const) {
    test(`Currency ${currency}: revenue, revenue/visitor and MRR are converted, not just re-symboled`, async ({
      page,
    }) => {
      await setCurrency(page, currency);
      const rate = RATES[currency];

      await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });
      await openDashboard(page, "revenue");
      await expectKpiValue(page, "Revenue", money(REVENUE_USD * rate, currency));
      const revenueTooltip = await hoverLatestChartPoint(page);
      await expect(revenueTooltip).toContainText(money(REVENUE_USD * rate, currency));

      // Isolates #3: $99 / 3 visitors = $33, so the converted figure is 33 × rate.
      await openDashboard(page, "revenue_per_visitor");
      await expectKpiValue(page, "Revenue/visitor", money((REVENUE_USD / VISITORS) * rate, currency));

      await openDashboard(page, "revenue");
      const barTooltip = await hoverPagesBarRow(page);
      await expect(barTooltip).toContainText(money(REVENUE_USD * rate, currency));

      await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "mrr" });
      await openDashboard(page, "revenue");
      await expectKpiValue(page, "MRR", money(MRR_USD * rate, currency));
      const mrrTooltip = await hoverLatestChartPoint(page);
      await expect(mrrTooltip).toContainText(money(MRR_USD * rate, currency));
    });
  }

  test("KPI settings UI: selecting a tracked goal persists across refresh", async ({ page }) => {
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });
    await page.goto(`/${slug}/settings/script`);
    await expect(page.getByText("What's the most important metric")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await goalPicker(page).click();
    await page.getByRole("option", { name: "Trial Started" }).click();
    await page.getByRole("button", { name: "Save KPI" }).click();
    await expect(page.getByText('KPI set to "Trial Started"')).toBeVisible();

    await expect
      .poll(async () =>
        (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).kpiEventName
      )
      .toBe("trial_started");

    await page.reload();
    await expect(page.getByRole("button", { name: "Trial Started" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("KPI settings UI: a tracked goal with zero events saves, persists and renders an empty goal", async ({
    page,
  }) => {
    // Created the way the "Add Goal" modal does it — a tracked goal that has
    // never fired.
    const created = await page.request.post(`/api/workspaces/${slug}/tracked-events`, {
      data: { eventName: "zero_goal" },
    });
    expect(created.status()).toBe(201);
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });

    await page.goto(`/${slug}/settings/script`);
    await expect(page.getByText("What's the most important metric")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await goalPicker(page).click();
    await page.getByRole("option", { name: "Zero Goal" }).click();
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/api/workspaces/${slug}/kpi`) && r.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "Save KPI" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText('KPI set to "Zero Goal"')).toBeVisible();

    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect({ kpiType: ws.kpiType, kpiEventName: ws.kpiEventName }).toEqual({
      kpiType: "goal",
      kpiEventName: "zero_goal",
    });

    await page.reload();
    await expect(page.getByRole("button", { name: "Zero Goal" })).toBeVisible({ timeout: 30_000 });

    await openDashboard(page, "revenue");
    await expectKpiValue(page, "zero_goal", "0");
    await expect(page.locator('span[title="Revenue"]')).toHaveCount(0);
  });

  test("KPI settings UI: never reports success for a save that didn't persist", async ({ page }) => {
    const created = await page.request.post(`/api/workspaces/${slug}/tracked-events`, {
      data: { eventName: "vanishing_goal" },
    });
    expect(created.status()).toBe(201);
    await setKpi(page, { kpiType: "revenue", kpiRevenueMetric: "revenue" });

    await page.goto(`/${slug}/settings/script`);
    await expect(page.getByText("What's the most important metric")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await goalPicker(page).click();
    await page.getByRole("option", { name: "Vanishing Goal" }).click();

    // The goal disappears after the dropdown loaded but before Save.
    await prisma.trackedEvent.deleteMany({
      where: { workspaceId, eventName: "vanishing_goal" },
    });

    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/api/workspaces/${slug}/kpi`) && r.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "Save KPI" }).click();
    await saved;
    await page.waitForTimeout(1500); // let any toast render

    const showedSuccess = await page.getByText('KPI set to "Vanishing Goal"').isVisible();
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const persisted = ws.kpiType === "goal" && ws.kpiEventName === "vanishing_goal";
    expect(
      { showedSuccess, persisted },
      "a success toast must only appear when the KPI was actually saved"
    ).not.toEqual({ showedSuccess: true, persisted: false });
  });

  test("Currency picker loads the saved currency, saves a change, and persists it", async ({
    page,
  }) => {
    await setCurrency(page, "INR");

    const card = page
      .locator("div.rounded-2xl", { hasText: "Used for all revenue and payment conversions" })
      .last();
    const picker = card.getByRole("button", { name: /^[A-Z]{3} - / });
    const save = card.getByRole("button", { name: "Save", exact: true });

    // Record every state the picker passes through while the page loads.
    await page.goto(`/${slug}/settings/revenue`);
    await expect(picker).toBeVisible({ timeout: 60_000 });
    const seenWhileLoading = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seenWhileLoading.add(`${await picker.innerText()} | save ${(await save.isEnabled()) ? "enabled" : "disabled"}`);
      await page.waitForTimeout(150);
    }
    expect(
      [...seenWhileLoading],
      "persisted INR must not be shown as USD with Save enabled while loading"
    ).toEqual(["INR - Indian Rupee (₹) | save disabled"]);

    await page.reload();
    await expect(picker).toHaveText("INR - Indian Rupee (₹)", { timeout: 30_000 });
    await expect(save).toBeDisabled();

    await picker.click();
    await page.getByRole("option", { name: "EUR - Euro (€)" }).click();
    await expect(picker).toHaveText("EUR - Euro (€)");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText("Currency updated to EUR")).toBeVisible();
    await expect
      .poll(async () => (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).currency)
      .toBe("EUR");

    await page.reload();
    await expect(picker).toHaveText("EUR - Euro (€)", { timeout: 30_000 });
    await expect(save).toBeDisabled();
  });

  test("BotFilteringCard defaults to AI Answers, and tabs still switch", async ({ page }) => {
    await openDashboard(page, "clicks");
    const aiAnswers = page.getByRole("button", { name: "AI Answers" });
    await aiAnswers.scrollIntoViewIfNeeded();
    await expect(aiAnswers).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Training" })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    await page.getByRole("button", { name: "Training" }).click();
    await expect(page.getByRole("button", { name: "Training" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.getByRole("button", { name: "Indexing" }).click();
    await expect(page.getByRole("button", { name: "Indexing" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.reload();
    await expect(page.getByRole("button", { name: "AI Answers" })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 60_000 }
    );
  });
});
