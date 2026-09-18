import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    funnel: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/auth/hash-token", () => ({
  hashToken: vi.fn(async (t: string) => `hashed:${t}`),
}));
vi.mock("@/lib/api/v1/rate-limit", () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 60, remaining: 59, retryAfter: 0 }),
}));
vi.mock("@/lib/analytics/get-funnel-analytics", () => ({
  getFunnelAnalytics: vi.fn(),
}));

import { prisma } from "@repo/db";
import { getFunnelAnalytics } from "@/lib/analytics/get-funnel-analytics";
import { GET } from "./route";

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

async function call(funnelId: string, scopes = "analytics.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/funnels/${funnelId}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({ funnelId }) });
}

describe("GET /api/v1/analytics/funnels/:funnelId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403s without analytics.read", async () => {
    const res = await call("f1", "goals.read");
    expect(res.status).toBe(403);
    expect(getFunnelAnalytics).not.toHaveBeenCalled();
  });

  it("404s for a nonexistent/foreign funnel before ever calling getFunnelAnalytics", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue(null);
    const res = await call("missing");
    expect(res.status).toBe(404);
    expect(getFunnelAnalytics).not.toHaveBeenCalled();
  });

  it("builds `steps` from the funnel's ordered FunnelStep.value and never passes totalRevenue", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue({
      id: "f1",
      steps: [
        { value: "signup", order: 0 },
        { value: "purchase", order: 1 },
      ],
    });
    (getFunnelAnalytics as any).mockResolvedValue([
      { step: "signup", users: 100, topSources: [], topCountries: [] },
      { step: "purchase", users: 20, topSources: [], topCountries: [] },
    ]);

    const res = await call("f1");
    expect(res.status).toBe(200);
    expect(getFunnelAnalytics).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      steps: ["signup", "purchase"],
    });
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // no fabricated stepValue anywhere in the response
    expect(JSON.stringify(body)).not.toContain("stepValue");
  });

  it("handles a funnel with multiple steps and returns per-step conversion counts in order", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue({
      id: "f1",
      steps: [
        { value: "a", order: 0 },
        { value: "b", order: 1 },
        { value: "c", order: 2 },
      ],
    });
    (getFunnelAnalytics as any).mockResolvedValue([
      { step: "a", users: 300, topSources: [], topCountries: [] },
      { step: "b", users: 90, topSources: [], topCountries: [] },
      { step: "c", users: 10, topSources: [], topCountries: [] },
    ]);
    const res = await call("f1");
    const body = await res.json();
    expect(body.data.map((r: any) => r.users)).toEqual([300, 90, 10]);
  });

  it("returns an empty array for a funnel with no completions, without erroring", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue({ id: "f1", steps: [{ value: "signup", order: 0 }] });
    (getFunnelAnalytics as any).mockResolvedValue([]);
    const res = await call("f1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
