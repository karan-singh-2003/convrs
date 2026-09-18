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
vi.mock("@/lib/analytics/live-visitors", () => ({
  getLiveStats: vi.fn(),
}));

import { prisma } from "@repo/db";
import { getLiveStats } from "@/lib/analytics/live-visitors";
import { GET } from "./route";

function req(token = "cvrs_valid") {
  return new NextRequest("http://localhost/api/v1/analytics/realtime", {
    headers: { authorization: `Bearer ${token}` },
  });
}

const token = { id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1" };
const workspace = { id: "ws_1", projectToken: "pt_abc123", timezone: "UTC", currency: "USD" };

describe("GET /api/v1/analytics/realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(token);
    (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  });

  it("calls getLiveStats with the workspace's projectToken, not its id", async () => {
    (getLiveStats as any).mockResolvedValue({
      count: 3,
      pages: [{ page: "/", count: 3 }],
      points: [],
      referrers: [],
      countries: [],
    });

    const res = await GET(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(getLiveStats).toHaveBeenCalledWith("pt_abc123");

    const body = await res.json();
    expect(body.data.count).toBe(3);
  });

  it("returns zeroed stats without erroring when the workspace has no projectToken", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ ...workspace, projectToken: null });

    const res = await GET(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(getLiveStats).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.data).toEqual({ count: 0, pages: [], points: [], referrers: [], countries: [] });
  });

  it("rejects a token without analytics.read", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({ ...token, scopes: "websites.read" });
    const res = await GET(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("rejects missing auth", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/v1/analytics/realtime"),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(401);
  });
});
