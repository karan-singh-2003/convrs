import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createBillingTestWorkspace } from "../fixtures/seed";
import { USERS } from "../fixtures/seed-data";

// Expired-trial access restriction: without an unexpired trial or a paid
// subscription, every private workspace route must land on /{slug}/billing —
// on direct URL loads *and* on client-side navigation from the billing page
// (the [slug] layout is shared with /billing, so a layout-only check is
// skipped on client navigation; the proxy enforces it per request). Billing
// itself must keep rendering, with no redirect loop.

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIVATE_PATHS = ["", "/settings", "/customers", "/realtime"];

async function ownedWorkspace(
  prefix: string,
  state: { subscriptionStatus: "trialing" | "active"; freeTrialEndDate: Date | null }
) {
  const ws = await createBillingTestWorkspace(prefix, { ...state, usageLimit: 10_000 });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: USERS.owner.email } });
  await prisma.workspaceUsers.create({ data: { workspaceId: ws.id, userId: owner.id, role: "owner" } });
  return ws.slug!;
}

/** Navigates and returns the final pathname plus how many redirects it took. */
async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  let hops = 0;
  for (let r = response?.request().redirectedFrom(); r; r = r.redirectedFrom()) hops++;
  return { pathname: new URL(page.url()).pathname, hops };
}

const bottomNav = (page: Page) => page.locator("div.fixed.bottom-5");

/**
 * A workspace attached to a real Subscription row, with the workspace's
 * billing cache mirroring it (what fan-out writes). A cardless trial has no
 * dodoSubscriptionId; a paid subscription has one.
 */
async function workspaceWithSubscription(
  prefix: string,
  sub: {
    status: "trialing" | "inactive" | "active";
    planFamily: "standard" | "growth";
    planTier: string;
    trialEndsAt: Date | null;
    dodoSubscriptionId: string | null;
  }
) {
  const ws = await createBillingTestWorkspace(prefix, {
    subscriptionStatus: sub.status,
    freeTrialEndDate: sub.trialEndsAt,
    usageLimit: 10_000,
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: USERS.owner.email } });
  await prisma.workspaceUsers.create({ data: { workspaceId: ws.id, userId: owner.id, role: "owner" } });
  // Granting any trial sets User.freeTrialUsedAt for life (I-14, see
  // apps/web/lib/billing/auto-trial.ts) — a trial-derived row without it is a
  // state the app can't produce.
  if (sub.trialEndsAt && !owner.freeTrialUsedAt) {
    await prisma.user.update({ where: { id: owner.id }, data: { freeTrialUsedAt: new Date(Date.now() - 20 * DAY_MS) } });
  }
  const subscription = await prisma.subscription.create({
    data: {
      ownerUserId: owner.id,
      planFamily: sub.planFamily,
      planTier: sub.planTier,
      tierEvents: 10_000,
      billingInterval: "month",
      status: sub.status,
      maxWorkspaces: sub.planFamily === "growth" ? 30 : 1,
      workspaceCount: 1,
      trialEndsAt: sub.trialEndsAt,
      dodoSubscriptionId: sub.dodoSubscriptionId,
    },
  });
  await prisma.workspace.update({
    where: { id: ws.id },
    data: { subscriptionId: subscription.id, planFamily: sub.planFamily },
  });
  return { slug: ws.slug!, subscriptionId: subscription.id };
}

/** A plan card on the billing page, by its title ("Standard" / "Growth"). */
const planCard = (page: Page, title: string) =>
  page
    .locator('div[class*="rounded-[2rem]"]')
    .filter({ has: page.locator("h1", { hasText: new RegExp(`^${title}$`, "i") }) });

test.describe("expired-trial access restriction", () => {
  test.use({ storageState: ".auth/owner.json" });
  test.setTimeout(120_000);

  test("active trial: private routes are accessible and the dashboard nav is shown", async ({ page }) => {
    const slug = await ownedWorkspace("trial-active", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() + 7 * DAY_MS),
    });
    for (const sub of PRIVATE_PATHS) {
      expect((await visit(page, `/${slug}${sub}`)).pathname).toBe(`/${slug}${sub}`);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, `/${slug}/settings`);
    await expect(bottomNav(page).locator(`a[href="/${slug}"]`)).toBeVisible({ timeout: 30_000 });
  });

  test("paid subscription: private routes are accessible", async ({ page }) => {
    const slug = await ownedWorkspace("paid", { subscriptionStatus: "active", freeTrialEndDate: null });
    for (const sub of PRIVATE_PATHS) {
      expect((await visit(page, `/${slug}${sub}`)).pathname).toBe(`/${slug}${sub}`);
    }
  });

  test("expired trial: every private route redirects to billing by direct URL", async ({ page }) => {
    // The "Only 0 days left" state: still `trialing`, end date in the past.
    const slug = await ownedWorkspace("trial-expired", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() - DAY_MS),
    });
    for (const sub of [...PRIVATE_PATHS, "/settings/members", "/customers/details"]) {
      expect((await visit(page, `/${slug}${sub}`)).pathname, `/${slug}${sub}`).toBe(`/${slug}/billing`);
    }
  });

  test("expired trial: billing renders with no redirect loop and no private nav", async ({ page }) => {
    const slug = await ownedWorkspace("trial-expired-billing", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() - DAY_MS),
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    const { pathname, hops } = await visit(page, `/${slug}/billing`);
    expect(pathname).toBe(`/${slug}/billing`);
    expect(hops).toBe(0);
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible({ timeout: 30_000 });

    // The bottom bar must not offer any private route.
    await expect(bottomNav(page)).toHaveCount(0);
    for (const sub of ["", "/customers", "/settings", "/realtime"]) {
      await expect(bottomNav(page).locator(`a[href="/${slug}${sub}"]`)).toHaveCount(0);
    }
  });

  test("expired trial: client-side navigation from billing cannot reach private routes", async ({ page }) => {
    const slug = await ownedWorkspace("trial-expired-clientnav", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() - DAY_MS),
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit(page, `/${slug}/billing`);
    const billingHeading = page.getByRole("heading", { name: "Billing", exact: true });
    await expect(billingHeading).toBeVisible({ timeout: 30_000 });

    // Billing's own "Back" control: router.push(`/${slug}`) — a soft navigation.
    await page.getByRole("heading", { name: "Back" }).click();
    await page.waitForTimeout(2_000);
    expect(new URL(page.url()).pathname).toBe(`/${slug}/billing`);
    await expect(billingHeading).toBeVisible();

    // The sidebar's next/link items to private routes are a soft navigation
    // too and must be bounced the same way. At this viewport the sidebar is a
    // closed drawer, so fire the link's click directly — next/link's onClick
    // turns it into the same client-side router navigation a user click makes.
    const sidebarLinks = page.locator(`a[href="/${slug}/settings"], a[href="/${slug}"]`);
    expect(await sidebarLinks.count()).toBeGreaterThan(0);
    for (const href of [`/${slug}/settings`, `/${slug}`]) {
      const link = page.locator(`a[href="${href}"]`).first();
      if (!(await link.count())) continue;
      await link.dispatchEvent("click");
      await page.waitForTimeout(2_000);
      expect(new URL(page.url()).pathname, `after clicking ${href}`).toBe(`/${slug}/billing`);
      await expect(billingHeading).toBeVisible();
    }
  });
});

test.describe("billing page: current plan follows entitlement, not the stored trial plan", () => {
  test.use({ storageState: ".auth/owner.json" });
  test.setTimeout(120_000);

  async function openBilling(page: Page, slug: string) {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await visit(page, `/${slug}/billing`)).pathname).toBe(`/${slug}/billing`);
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible({ timeout: 30_000 });
  }

  test("active cardless trial: Standard is the current (trial) plan", async ({ page }) => {
    const { slug } = await workspaceWithSubscription("bill-trial", {
      status: "trialing",
      planFamily: "standard",
      planTier: "t10k",
      trialEndsAt: new Date(Date.now() + 7 * DAY_MS),
      dodoSubscriptionId: null,
    });
    await openBilling(page, slug);
    await expect(planCard(page, "Standard").getByRole("button", { name: "Current plan" })).toBeDisabled();
    await expect(planCard(page, "Growth").getByRole("button", { name: "Pick Growth Plan" })).toBeEnabled();
    await expect(page.getByText("Trial expired")).toHaveCount(0);
  });

  for (const status of ["trialing", "inactive"] as const) {
    test(`expired cardless trial (stored status "${status}"): no current plan; Standard and Growth are selectable`, async ({ page }) => {
      const trialEndsAt = new Date(Date.now() - DAY_MS);
      const { slug, subscriptionId } = await workspaceWithSubscription(`bill-expired-${status}`, {
        status,
        planFamily: "standard",
        planTier: "t10k",
        trialEndsAt,
        dodoSubscriptionId: null,
      });
      await openBilling(page, slug);

      await expect(page.getByText("Trial expired", { exact: true })).toBeVisible();
      await expect(page.getByText(/No active plan/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Current plan" })).toHaveCount(0);
      await expect(planCard(page, "Standard").getByRole("button", { name: "Pick Standard Plan" })).toBeEnabled();
      await expect(planCard(page, "Growth").getByRole("button", { name: "Pick Growth Plan" })).toBeEnabled();
      // Paid pricing, not a "$0 then ..." trial offer.
      await expect(planCard(page, "Standard")).toContainText("$9");
      await expect(planCard(page, "Standard")).not.toContainText("$0");

      // Viewing billing never converts or mutates the lapsed trial.
      const row = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(row).toMatchObject({ status, dodoSubscriptionId: null, planFamily: "standard", planTier: "t10k" });

      // Private routes stay locked.
      for (const sub of PRIVATE_PATHS) {
        expect((await visit(page, `/${slug}${sub}`)).pathname).toBe(`/${slug}/billing`);
      }
    });
  }

  for (const [family, title] of [["standard", "Standard"], ["growth", "Growth"]] as const) {
    test(`active paid ${title}: ${title} is current and private routes stay accessible`, async ({ page }) => {
      const { slug } = await workspaceWithSubscription(`bill-paid-${family}`, {
        status: "active",
        planFamily: family,
        planTier: "t10k",
        // A converted trial keeps its (past) trial end date populated.
        trialEndsAt: new Date(Date.now() - 20 * DAY_MS),
        dodoSubscriptionId: `sub_e2e_${family}_${Date.now()}`,
      });
      await openBilling(page, slug);
      await expect(planCard(page, title).getByRole("button", { name: "Current plan" })).toBeDisabled();
      await expect(page.getByText("Trial expired")).toHaveCount(0);
      for (const sub of PRIVATE_PATHS) {
        expect((await visit(page, `/${slug}${sub}`)).pathname).toBe(`/${slug}${sub}`);
      }
    });
  }
});

test.describe("expired trial: the upgrade flow is reachable without touching Dodo", () => {
  test.use({ storageState: ".auth/owner.json" });
  test.setTimeout(120_000);

  for (const [family, title] of [["standard", "Standard"], ["growth", "Growth"]] as const) {
    test(`selecting ${title} starts checkout for that plan and leaves the lapsed trial row untouched`, async ({ page }) => {
      const { slug, subscriptionId } = await workspaceWithSubscription(`bill-pick-${family}`, {
        status: "inactive",
        planFamily: "standard",
        planTier: "t10k",
        trialEndsAt: new Date(Date.now() - DAY_MS),
        dodoSubscriptionId: null,
      });
      const before = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });

      // The checkout request is intercepted in the browser and never reaches
      // the server, so no Dodo checkout session (live or test) is created and
      // nothing is paid. Server-side pre-checkout behaviour is unit-tested in
      // apps/web/lib/billing/checkout-trial-reuse.test.ts.
      const requests: Record<string, unknown>[] = [];
      await page.route("**/api/subscriptions", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ json: { checkoutUrl: `/${slug}/billing?checkout=intercepted` } });
      });

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${slug}/billing`);
      await page.getByRole("button", { name: `Pick ${title} Plan` }).click();
      await page.waitForURL(/checkout=intercepted/);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ intent: family, tier: "t10k", interval: "monthly" });
      expect(String(requests[0].targetWorkspaceId)).toBeTruthy();

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(after).toEqual(before);
      expect(after.dodoSubscriptionId).toBeNull();
    });
  }
});
