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

import { prisma } from "@repo/db";
import { GET } from "./route";

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD" };

async function call(funnelId: string, auth = true) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue(
    auth ? { id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1" } : null
  );
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = "Bearer cvrs_valid";
  const request = new NextRequest(`http://localhost/api/v1/funnels/${funnelId}`, { headers });
  return GET(request, { params: Promise.resolve({ funnelId }) });
}

describe("GET /api/v1/funnels/:funnelId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s with an invalid token", async () => {
    const res = await call("f1", false);
    expect(res.status).toBe(401);
  });

  it("returns the funnel with its ordered steps", async () => {
    const funnel = {
      id: "f1",
      name: "Signup",
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { id: "s1", name: "Visit", value: "/pricing", type: "page_view", order: 0 },
        { id: "s2", name: "Signup", value: "signup", type: "goal", order: 1 },
      ],
    };
    (prisma.funnel.findFirst as any).mockResolvedValue(funnel);
    const res = await call("f1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.steps).toHaveLength(2);
    expect(body.data.steps[0].type).toBe("page_view");
  });

  it("404s for a nonexistent funnel", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue(null);
    const res = await call("missing");
    expect(res.status).toBe(404);
  });

  it("404s (never leaks) for a funnel belonging to another workspace", async () => {
    // getWorkspaceFunnelById always includes workspaceId in the where clause,
    // so a foreign funnel ID resolves the same way Prisma would: not found.
    (prisma.funnel.findFirst as any).mockResolvedValue(null);
    const res = await call("f_from_another_workspace");
    expect(res.status).toBe(404);
    expect(prisma.funnel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "f_from_another_workspace", workspaceId: "ws_1" } })
    );
  });
});
