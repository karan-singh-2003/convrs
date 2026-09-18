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

async function call(qs = "", scopes = "analytics.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/revenue/by-source${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/revenue/by-source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403s without analytics.read", async () => {
    const res = await call("", "goals.read");
    expect(res.status).toBe(403);
  });

  it("defaults to the referrer dimension via v1_group_by groupBy=referers", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call();
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "referers" }));
  });

  it("supports utm_source/utm_medium/utm_campaign/campaign dimensions", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    for (const [dim, groupBy] of [
      ["utm_source", "utm_sources"],
      ["utm_medium", "utm_mediums"],
      ["utm_campaign", "utm_campaigns"],
      ["campaign", "campaigns"],
      ["referrer_url", "referer_urls"],
    ] as const) {
      await call(`?dimension=${dim}`);
      expect(getAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy }));
    }
  });

  it("rejects an unsupported dimension", async () => {
    const res = await call("?dimension=not_a_dimension");
    expect(res.status).toBe(400);
  });

  it("rejects the mrr metric (not correctly computed for dimension breakdowns)", async () => {
    const res = await call("?metrics=mrr");
    expect(res.status).toBe(400);
  });

  it("rejects the visitors metric (this endpoint is revenue-scoped only)", async () => {
    const res = await call("?metrics=visitors");
    expect(res.status).toBe(400);
  });

  it("returns revenue rows shaped like the dimension config", async () => {
    (getAnalytics as any).mockResolvedValue([
      { groupByField: "google.com", referer: "google.com", revenue: 250, conversions: 3, revenue_per_visitor: 10, conversion_rate: 5 },
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.data[0]).toEqual({
      referrer: "google.com",
      revenue: 250,
      conversions: 3,
      revenue_per_visitor: 10,
      conversion_rate: 5,
    });
  });

  it("reports zero revenue rows as 0, not omitted", async () => {
    (getAnalytics as any).mockResolvedValue([
      { referer: "(direct)", revenue: 0, conversions: 0, revenue_per_visitor: 0, conversion_rate: 0 },
    ]);
    const res = await call("?metrics=revenue");
    const body = await res.json();
    expect(body.data[0].revenue).toBe(0);
  });

  it("returns an empty array when there's no revenue-attributed traffic", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("paginates", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ referer: `site${i}.com`, revenue: i }));
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

  it("supports hostname/date filters same as /analytics/sources", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?hostname=blog.example.com&interval=7d");
    const args = (getAnalytics as any).mock.calls[0][0];
    expect(args.hostname).toBeDefined();
    expect(args.interval).toBe("7d");
  });
});
