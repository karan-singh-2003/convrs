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
vi.mock("@/lib/analytics/get-bot-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/get-bot-analytics")>();
  return { ...actual, getBotFilteringAnalytics: vi.fn() };
});

import { prisma } from "@repo/db";
import { getBotFilteringAnalytics } from "@/lib/analytics/get-bot-analytics";
import { GET } from "./route";

function req(qs = "") {
  return new NextRequest(`http://localhost/api/v1/analytics/bots${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
}

const token = { id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1" };
const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

describe("GET /api/v1/analytics/bots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(token);
    (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  });

  it("defaults to breakdown=count and returns a single object", async () => {
    (getBotFilteringAnalytics as any).mockResolvedValue({
      total_requests: 10, ai_answers: 4, indexing: 3, training: 2, other: 1, unique_providers: 3,
    });
    const res = await GET(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total_requests).toBe(10);
    expect(getBotFilteringAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws_1", groupBy: "count" })
    );
  });

  it("returns zeroed defaults for breakdown=count when the pipe returns null", async () => {
    (getBotFilteringAnalytics as any).mockResolvedValue(null);
    const res = await GET(req(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.data).toEqual({
      total_requests: 0, ai_answers: 0, indexing: 0, training: 0, other: 0, unique_providers: 0,
    });
  });

  it("paginates breakdown=providers", async () => {
    (getBotFilteringAnalytics as any).mockResolvedValue([
      { vendor: "GPTBot", category: "training_crawler", requests: 100 },
      { vendor: "ClaudeBot", category: "training_crawler", requests: 50 },
    ]);
    const res = await GET(req("?breakdown=providers&limit=1"), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 1, hasMore: true });
  });

  it("rejects an invalid category", async () => {
    const res = await GET(req("?category=not_a_real_category"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await GET(req("?websiteId=ws_someone_else"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });
});
