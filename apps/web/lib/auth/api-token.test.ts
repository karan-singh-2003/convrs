import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./hash-token", () => ({
  // Deterministic stand-in for SHA-256 so tests can control lookups by token
  // string without hashing anything for real.
  hashToken: vi.fn(async (token: string) => `hashed:${token}`),
}));

vi.mock("../api/v1/rate-limit", () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 60,
    remaining: 59,
    retryAfter: 0,
  }),
}));

import { prisma } from "@repo/db";
import { checkApiRateLimit } from "../api/v1/rate-limit";
import { withApiToken } from "./api-token";

function makeRequest(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/v1/analytics", { headers });
}

const handler = vi.fn(async ({ workspace, token }) =>
  Response.json({ ok: true, workspaceId: workspace.id, tokenId: token.id })
);

const baseWorkspace = {
  id: "ws_1",
  domain: "example.com",
  timezone: "UTC",
  currency: "USD",
  plan: "free",
  planFamily: "standard",
  subscriptionStatus: "active",
  freeTrialEndDate: null,
  paymentFailedAt: null,
};

const baseToken = {
  id: "tok_1",
  name: "My token",
  scopes: "analytics.read",
  expires: null,
  workspaceId: "ws_1",
};

describe("withApiToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkApiRateLimit as any).mockResolvedValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      retryAfter: 0,
    });
  });

  it("rejects a request with no Authorization header", async () => {
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header (not Bearer)", async () => {
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const req = new NextRequest("http://localhost/api/v1/analytics", {
      headers: { authorization: "Token cvrs_abc" },
    });
    const res = await route(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("rejects a token with an unrecognized prefix", async () => {
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("sk_live_notconvrs"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
    expect(prisma.restrictedToken.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown (invalid or revoked/deleted) token", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(null);
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_doesnotexist"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects an expired token", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      ...baseToken,
      expires: new Date(Date.now() - 1000),
    });
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_expired"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a token missing the required scope", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      ...baseToken,
      scopes: "websites.read", // no analytics.read
    });
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_readonlywebsites"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("forbidden");
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts apis.all as satisfying any required scope", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      ...baseToken,
      scopes: "apis.all",
    });
    (prisma.workspace.findUnique as any).mockResolvedValue(baseWorkspace);
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_allaccess"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });

  it("accepts a legacy bc_-prefixed token", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (prisma.workspace.findUnique as any).mockResolvedValue(baseWorkspace);
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("bc_legacytoken"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });

  it("returns 429 when the rate limit is exceeded, without calling the handler", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (checkApiRateLimit as any).mockResolvedValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      retryAfter: 12,
    });
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_ratelimited"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(handler).not.toHaveBeenCalled();
  });

  it("treats a token whose workspace was deleted as invalid", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (prisma.workspace.findUnique as any).mockResolvedValue(null);
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_orphaned"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler with the token's own workspace on success", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (prisma.workspace.findUnique as any).mockResolvedValue(baseWorkspace);
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_valid"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws_1");
    expect(body.tokenId).toBe("tok_1");
    // never returns the raw token or its hash back to the caller
    expect(JSON.stringify(body)).not.toContain("hashed:");
  });

  it("rejects (402 upgrade_required) a valid token whose workspace has no active subscription/trial — billing-wall bypass fix", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (prisma.workspace.findUnique as any).mockResolvedValue({
      ...baseWorkspace,
      subscriptionStatus: "canceled",
    });
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_valid"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("upgrade_required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows a token whose workspace is on an unexpired trial", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue(baseToken);
    (prisma.workspace.findUnique as any).mockResolvedValue({
      ...baseWorkspace,
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    const route = withApiToken(handler, { requiredScope: "analytics.read" });
    const res = await route(makeRequest("cvrs_valid"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });

  it("allows any valid token through when no scope is required", async () => {
    (prisma.restrictedToken.findUnique as any).mockResolvedValue({
      ...baseToken,
      scopes: "",
    });
    (prisma.workspace.findUnique as any).mockResolvedValue(baseWorkspace);
    const route = withApiToken(handler); // no requiredScope
    const res = await route(makeRequest("cvrs_noscopes"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });
});
