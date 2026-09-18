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

async function call(qs = "", workspace: any = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" }) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/revenue/timeseries${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/revenue/timeseries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403s without analytics.read", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      id: "tok_1", name: "t", scopes: "payments.read", expires: null, workspaceId: "ws_1",
    });
    const res = await GET(
      new NextRequest("http://localhost/api/v1/analytics/revenue/timeseries", {
        headers: { authorization: "Bearer cvrs_valid" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(403);
  });

  it("returns currency + points, renaming start to date", async () => {
    (getAnalytics as any).mockResolvedValue([
      { start: "2026-09-01T00:00:00.000Z", revenue: 500, revenue_per_visitor: 5, conversion_rate: 2 },
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe("USD");
    expect(body.data.points[0].date).toBe("2026-09-01T00:00:00.000Z");
    expect(body.data.points[0].revenue).toBe(500);
  });

  it("reports zero revenue as 0, not an error or missing field", async () => {
    (getAnalytics as any).mockResolvedValue([
      { start: "2026-09-01T00:00:00.000Z", revenue: 0 },
    ]);
    const res = await call("?metrics=revenue");
    const body = await res.json();
    expect(body.data.points[0]).toEqual({ date: "2026-09-01T00:00:00.000Z", revenue: 0 });
  });

  it("preserves the workspace's own currency for a non-USD workspace", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call("", { id: "ws_1", timezone: "UTC", currency: "INR", subscriptionStatus: "active" });
    const body = await res.json();
    expect(body.data.currency).toBe("INR");
  });

  it("switches to mrr when requested and rejects revenue+mrr together", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?metrics=mrr");
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ revenueMetric: "mrr" }));

    const conflict = await call("?metrics=revenue,mrr");
    expect(conflict.status).toBe(400);
  });

  it("rejects an unknown metric", async () => {
    const res = await call("?metrics=pageviews");
    expect(res.status).toBe(400);
  });

  it("respects an explicit date range", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?startAt=2026-09-01&endAt=2026-09-15");
    const args = (getAnalytics as any).mock.calls[0][0];
    expect(args.start).toBeInstanceOf(Date);
    expect(args.end).toBeInstanceOf(Date);
  });

  it("rejects a date range wider than 366 days", async () => {
    const res = await call("?startAt=2020-01-01&endAt=2026-01-01");
    expect(res.status).toBe(400);
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });

  it("returns an empty points array when there is no data, not an error", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call();
    const body = await res.json();
    expect(body.data.points).toEqual([]);
  });
});
