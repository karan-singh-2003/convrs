import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    trackedEvent: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/hash-token", () => ({
  hashToken: vi.fn(async (t: string) => `hashed:${t}`),
}));
vi.mock("@/lib/api/v1/rate-limit", () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 60, remaining: 59, retryAfter: 0 }),
}));

import { prisma } from "@repo/db";
import { GET } from "./route";
import { OVERVIEW_METRICS, DIMENSION_METRICS, REVENUE_METRICS } from "@/lib/api/v1/metrics";
import { V1_INTERVALS } from "@/lib/api/v1/query";

async function call(scopes = "analytics.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_1", timezone: "UTC", currency: "USD" });
  (prisma.trackedEvent.findMany as any).mockResolvedValue([
    { eventName: "signup", eventType: "goals", trigger: "goal", firstSeenAt: new Date(), lastSeenAt: new Date() },
  ]);
  const request = new NextRequest("http://localhost/api/v1/meta", {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/meta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reflects the real metric/dimension constants, not a hand-duplicated list", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.intervals).toEqual(V1_INTERVALS);
    expect(body.data.analytics.metrics).toEqual(OVERVIEW_METRICS);
    expect(body.data.revenue.metrics).toEqual(REVENUE_METRICS);
    expect(body.data.breakdowns.pages.metrics).toEqual(DIMENSION_METRICS);
    expect(body.data.breakdowns.pages.dimensions).toEqual(
      expect.arrayContaining(["page", "hostname", "entrypage", "exitlink"])
    );
    expect(body.data.breakdowns.geo.dimensions).toEqual(
      expect.arrayContaining(["country", "region", "city", "continent"])
    );
  });

  it("includes this workspace's actual goal catalogue", async () => {
    const res = await call();
    const body = await res.json();
    expect(body.data.goals).toEqual(["signup"]);
  });

  // Regression test: /api/v1/meta is a discovery/metadata endpoint and must
  // work for ANY valid token, including one with zero resource scopes — it
  // must never require analytics.read (or any other single scope), since
  // that would block e.g. a payments-only or goals-only token from
  // introspecting what the API supports.
  it.each([
    ["no scopes at all", ""],
    ["analytics.read", "analytics.read"],
    ["goals.read", "goals.read"],
    ["payments.read", "payments.read"],
    ["websites.read", "websites.read"],
  ])("returns 200 for a valid token with %s", async (_label, scopes) => {
    const res = await call(scopes);
    expect(res.status).toBe(200);
  });

  it("401s for a missing token even though no scope is required", async () => {
    const request = new NextRequest("http://localhost/api/v1/meta");
    const res = await GET(request, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("401s for an invalid token", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/meta", {
      headers: { authorization: "Bearer cvrs_doesnotexist" },
    });
    const res = await GET(request, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("401s for an expired token", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      id: "tok_1", name: "t", scopes: "", expires: new Date(Date.now() - 1000), workspaceId: "ws_1",
    });
    const request = new NextRequest("http://localhost/api/v1/meta", {
      headers: { authorization: "Bearer cvrs_expired" },
    });
    const res = await GET(request, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("401s for a revoked (deleted) token", async () => {
    // A revoked token's RestrictedToken row no longer exists, so the hash
    // lookup finds nothing — same code path as "invalid token".
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/meta", {
      headers: { authorization: "Bearer cvrs_revoked" },
    });
    const res = await GET(request, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });
});
