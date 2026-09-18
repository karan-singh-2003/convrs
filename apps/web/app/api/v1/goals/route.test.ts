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

function req(qs = "", scopes = "goals.read") {
  return { request: new NextRequest(`http://localhost/api/v1/goals${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  }), scopes };
}

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

async function call(qs = "", scopes = "goals.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const { request } = req(qs, scopes);
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/goals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires goals.read", async () => {
    const res = await call("", "analytics.read");
    expect(res.status).toBe(403);
  });

  it("lists goals for the token's workspace, paginated", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      eventName: `goal_${i}`,
      eventType: "goals",
      trigger: "goal",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    }));
    (prisma.trackedEvent.findMany as any).mockResolvedValue(rows);

    const res = await call("?limit=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, limit: 2, hasMore: true });
    expect(prisma.trackedEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1", eventType: "goals" },
        take: 3,
      })
    );
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });
});
