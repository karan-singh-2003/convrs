import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/hash-token", () => ({
  hashToken: vi.fn(async (t: string) => `hashed:${t}`),
}));
vi.mock("@/lib/api/v1/rate-limit", () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 60, remaining: 59, retryAfter: 0 }),
}));
vi.mock("@/lib/analytics/get-analytics", () => ({ getAnalytics: vi.fn() }));

import { prisma } from "@repo/db";
import { getAnalytics } from "@/lib/analytics/get-analytics";
import { GET } from "./route";

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD" };

async function call(qs = "", scopes = "goals.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/goals/properties${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/goals/properties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires goals.read", async () => {
    const res = await call("", "analytics.read");
    expect(res.status).toBe(403);
  });

  it("passes goalName through to getAnalytics as groupBy=goal_properties", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?goal=signup");
    expect(getAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBy: "goal_properties",
        goalName: "signup",
        workspaceId: "ws_1",
      })
    );
  });

  it("works with no goal specified (aggregates across all goals)", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call();
    expect(getAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ goalName: undefined })
    );
  });

  it("splits the concatenated goal_property back into key/value using the known prop_key length", async () => {
    (getAnalytics as any).mockResolvedValue([
      { goal_property: "plan::pro", prop_key: "plan", clicks: 12 },
      { goal_property: "plan::free", prop_key: "plan", clicks: 40 },
    ]);
    const res = await call("?goal=signup");
    const body = await res.json();
    expect(body.data).toEqual([
      { propertyKey: "plan", propertyValue: "pro", count: 12 },
      { propertyKey: "plan", propertyValue: "free", count: 40 },
    ]);
  });

  it("handles a value that itself contains '::' without corrupting the split", async () => {
    (getAnalytics as any).mockResolvedValue([
      { goal_property: "url::https://example.com::path", prop_key: "url", clicks: 3 },
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.data[0].propertyValue).toBe("https://example.com::path");
  });

  it("returns an empty array for a goal with no property data", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call("?goal=no_properties_goal");
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("paginates", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      goal_property: `k::v${i}`, prop_key: "k", clicks: i,
    }));
    (getAnalytics as any).mockResolvedValue(rows);
    const res = await call("?limit=2");
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.hasMore).toBe(true);
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });

  it("rejects an invalid interval", async () => {
    const res = await call("?interval=not-a-real-interval");
    expect(res.status).toBe(400);
  });
});
