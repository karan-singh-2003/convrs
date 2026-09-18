import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    funnel: { findMany: vi.fn() },
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

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD" };

function tokenWith(scopes: string) {
  return { id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1" };
}

async function call(qs = "", scopes = "analytics.read", auth = true) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue(
    auth ? tokenWith(scopes) : null
  );
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = "Bearer cvrs_valid";
  const request = new NextRequest(`http://localhost/api/v1/funnels${qs}`, { headers });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/funnels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s with no token", async () => {
    const res = await call("", "analytics.read", false);
    expect(res.status).toBe(401);
  });

  it("403s without analytics.read", async () => {
    const res = await call("", "payments.read");
    expect(res.status).toBe(403);
  });

  it("returns 200 with the funnel list for a valid token", async () => {
    (prisma.funnel.findMany as any).mockResolvedValue([
      { id: "f1", name: "Signup funnel", createdAt: new Date(), updatedAt: new Date(), steps: [] },
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 100, hasMore: false });
  });

  it("returns an empty list, not an error, when there are no funnels", async () => {
    (prisma.funnel.findMany as any).mockResolvedValue([]);
    const res = await call();
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("paginates", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `f${i}`, name: `F${i}`, createdAt: new Date(), updatedAt: new Date(), steps: [],
    }));
    (prisma.funnel.findMany as any).mockResolvedValue(rows);
    const res = await call("?limit=2");
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, limit: 2, hasMore: true });
  });

  it("400s on an invalid limit", async () => {
    const res = await call("?limit=99999");
    expect(res.status).toBe(400);
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });
});
