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

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

async function call(qs = "", scopes = "analytics.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/revenue/by-page${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/revenue/by-page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403s without analytics.read", async () => {
    const res = await call("", "payments.read");
    expect(res.status).toBe(403);
  });

  it("defaults to the page dimension", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call();
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "page" }));
  });

  it("supports hostname", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?dimension=hostname");
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "hostname" }));
  });

  it("rejects entrypage/exitlink — never populated on revenue events, so not offered here", async () => {
    const entry = await call("?dimension=entrypage");
    expect(entry.status).toBe(400);
    const exit = await call("?dimension=exitlink");
    expect(exit.status).toBe(400);
  });

  it("shapes rows with the page field", async () => {
    (getAnalytics as any).mockResolvedValue([
      { page: "/pricing", revenue: 1200, conversions: 6, revenue_per_visitor: 25, conversion_rate: 10 },
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.data[0]).toEqual({
      page: "/pricing",
      revenue: 1200,
      conversions: 6,
      revenue_per_visitor: 25,
      conversion_rate: 10,
    });
  });

  it("returns an empty array when no purchases have last-touch page attribution", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("paginates", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ page: `/p${i}`, revenue: i }));
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

  it("rejects an invalid limit", async () => {
    const res = await call("?limit=0");
    expect(res.status).toBe(400);
  });
});
