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
vi.mock("@/lib/analytics/get-goal-timeseries", () => ({
  getGoalsTimeseries: vi.fn(),
}));

import { prisma } from "@repo/db";
import { getGoalsTimeseries } from "@/lib/analytics/get-goal-timeseries";
import { GET } from "./route";

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD" };

async function call(qs = "", scopes = "goals.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/analytics/goals${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/analytics/goals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires goals.read (not just analytics.read)", async () => {
    const res = await call("", "analytics.read");
    expect(res.status).toBe(403);
  });

  it("renames groupByField to date in the response", async () => {
    (getGoalsTimeseries as any).mockResolvedValue([
      { groupByField: "2026-09-01T00:00:00.000Z", goal: "signup", count: 5 },
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([{ date: "2026-09-01T00:00:00.000Z", goal: "signup", count: 5 }]);
  });

  it("passes comma-separated goals through as an array", async () => {
    (getGoalsTimeseries as any).mockResolvedValue([]);
    await call("?goals=signup,purchase");
    expect(getGoalsTimeseries).toHaveBeenCalledWith(
      expect.objectContaining({ goalNames: ["signup", "purchase"] })
    );
  });

  it("handles a null result (no workspaceId) without crashing", async () => {
    (getGoalsTimeseries as any).mockResolvedValue(null);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
