import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Workspace rows by slug, as the proxy's access lookup reads them.
const workspaces: Record<string, Record<string, unknown>> = {};
let sqlError: Error | null = null;

vi.mock("@repo/db/edge", () => ({
  sql: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    if (sqlError) throw sqlError;
    const row = workspaces[values[0] as string];
    return row ? [row] : [];
  }),
}));
vi.mock("./utils/get-user-via-token", () => ({ getUserViaToken: vi.fn() }));
vi.mock("./utils/get-default-workspace", () => ({ getDefaultWorkspace: vi.fn(async () => "acme") }));
vi.mock("./utils/has-pending-invites", () => ({ hasPendingInvites: vi.fn(async () => false) }));
vi.mock("../api/workspaces/onboarding-step-cache", () => ({
  ONBOARDING_WINDOW_SECONDS: 60 * 60 * 24,
  onboardingStepCache: { get: vi.fn(async () => "completed") },
}));
vi.mock("./workspace", () => ({ WorkspacesMiddleware: vi.fn() }));

import { sql } from "@repo/db/edge";
import { getUserViaToken } from "./utils/get-user-via-token";
import { AppMiddleware } from "./app";

const DAY_MS = 24 * 60 * 60 * 1000;
const USER = { id: "user_1", email: "u@example.com", createdAt: new Date(Date.now() - 30 * DAY_MS) };

function request(path: string) {
  return new NextRequest(`http://app.localhost:8888${path}`, {
    headers: { host: "app.localhost:8888" },
  });
}

/** "redirect:<path>" for a redirect, "rewrite" when the page is served. */
async function outcome(path: string) {
  const res = await AppMiddleware(request(path));
  const location = res.headers.get("location");
  if (location) return `redirect:${new URL(location).pathname}`;
  return res.headers.get("x-middleware-rewrite") ? "rewrite" : "other";
}

const PRIVATE_ROUTES = [
  "/acme",
  "/acme/settings",
  "/acme/settings/members",
  "/acme/customers",
  "/acme/customers/details",
  "/acme/realtime",
];

describe("AppMiddleware — workspace access after the trial ends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlError = null;
    for (const k of Object.keys(workspaces)) delete workspaces[k];
    (getUserViaToken as any).mockResolvedValue(USER);
  });

  it.each(PRIVATE_ROUTES)("active trial: %s is served", async (path) => {
    workspaces.acme = { subscriptionStatus: "trialing", freeTrialEndDate: new Date(Date.now() + 5 * DAY_MS) };
    expect(await outcome(path)).toBe("rewrite");
  });

  it.each(PRIVATE_ROUTES)("paid subscription: %s is served", async (path) => {
    workspaces.acme = { subscriptionStatus: "active", freeTrialEndDate: null };
    expect(await outcome(path)).toBe("rewrite");
  });

  it.each(PRIVATE_ROUTES)("expired trial: %s redirects to /acme/billing", async (path) => {
    // Still "trialing" in the cache (the reconcile cron hasn't flipped it
    // yet) but the trial end date has passed — exactly the "0 days left" case.
    workspaces.acme = { subscriptionStatus: "trialing", freeTrialEndDate: new Date(Date.now() - DAY_MS) };
    expect(await outcome(path)).toBe("redirect:/acme/billing");
  });

  it.each(["expired", "inactive", "canceled"])("status %s: private route redirects to billing", async (status) => {
    workspaces.acme = { subscriptionStatus: status, freeTrialEndDate: new Date(Date.now() - DAY_MS) };
    expect(await outcome("/acme/settings")).toBe("redirect:/acme/billing");
  });

  it("keeps the slug when redirecting", async () => {
    workspaces["other-co"] = { subscriptionStatus: "expired" };
    expect(await outcome("/other-co/realtime")).toBe("redirect:/other-co/billing");
  });

  it.each(["/acme/billing", "/acme/billing/success", "/acme/invite"])(
    "expired trial: %s stays reachable (no redirect loop)",
    async (path) => {
      workspaces.acme = { subscriptionStatus: "trialing", freeTrialEndDate: new Date(Date.now() - DAY_MS) };
      expect(await outcome(path)).toBe("rewrite");
      expect(sql).not.toHaveBeenCalled();
    }
  );

  it.each(["/account/settings", "/dashboard", "/onboarding/new"])(
    "non-workspace route %s is never gated",
    async (path) => {
      expect(await outcome(path)).toBe("rewrite");
      expect(sql).not.toHaveBeenCalled();
    }
  );

  it("an unknown slug is passed through (so the page can 404)", async () => {
    expect(await outcome("/does-not-exist")).toBe("rewrite");
  });

  it("fails open on a lookup error (the [slug] layout and API checks still apply)", async () => {
    sqlError = new Error("db unavailable");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await outcome("/acme/settings")).toBe("rewrite");
  });

  it("logged-out requests still go to login, not billing", async () => {
    (getUserViaToken as any).mockResolvedValue(undefined);
    workspaces.acme = { subscriptionStatus: "expired" };
    const res = await AppMiddleware(request("/acme/settings"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});
