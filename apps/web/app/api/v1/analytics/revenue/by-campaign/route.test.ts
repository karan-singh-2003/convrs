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
  const request = new NextRequest(`http://localhost/api/v1/analytics/revenue/by-campaign${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/revenue/by-campaign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403s without analytics.read", async () => {
    const res = await call("", "goals.read");
    expect(res.status).toBe(403);
  });

  it("defaults to utm_campaign", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call();
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "utm_campaigns" }));
  });

  it("supports the full attribution query-string 'campaign' dimension", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?dimension=campaign");
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "campaigns" }));
  });

  it("rejects a dimension outside utm_campaign/campaign (e.g. utm_source belongs to by-source)", async () => {
    const res = await call("?dimension=utm_source");
    expect(res.status).toBe(400);
  });

  it("shapes rows with the utmCampaign field for the default dimension", async () => {
    (getAnalytics as any).mockResolvedValue([
      { utm_campaign: "summer_sale", revenue: 900, conversions: 4, revenue_per_visitor: 20, conversion_rate: 8 },
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.data[0].utmCampaign).toBe("summer_sale");
    expect(body.data[0].revenue).toBe(900);
  });

  it("returns an empty array for a period with no campaign-attributed revenue", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("paginates", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ utm_campaign: `c${i}`, revenue: i }));
    (getAnalytics as any).mockResolvedValue(rows);
    const res = await call("?limit=1");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.hasMore).toBe(true);
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });

  it("respects date-range filters", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await call("?interval=90d");
    expect(getAnalytics).toHaveBeenCalledWith(expect.objectContaining({ interval: "90d" }));
  });
});
