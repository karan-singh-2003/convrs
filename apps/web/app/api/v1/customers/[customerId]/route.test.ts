import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
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

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

async function call(customerId: string) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/customers/${customerId}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({ customerId }) });
}

describe("GET /api/v1/customers/:customerId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the customer scoped to the token's workspace", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue({ id: "cust_1", name: "Jane" });
    const res = await call("cust_1");
    expect(res.status).toBe(200);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cust_1", workspaceId: "ws_1" } })
    );
  });

  it("404s for a customer that doesn't exist in this workspace (IDOR-safe: a real customer ID from another workspace also 404s, never leaks)", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue(null);
    const res = await call("cust_from_another_workspace");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("redacts email and stripeCustomerId while keeping the other legitimate fields", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue({
      id: "cust_1",
      name: "Jane Doe",
      email: "jane@example.com",
      avatar: null,
      externalId: "user_42",
      stripeCustomerId: "cus_secretid123",
      country: "US",
      sales: 2,
      saleAmount: 9800,
      firstSaleAt: new Date("2026-03-01"),
      subscriptionCanceledAt: null,
      createdAt: new Date("2026-02-20"),
      updatedAt: new Date("2026-09-01"),
      device: "Desktop",
      browser: "Chrome",
    });

    const res = await call("cust_1");
    const body = await res.json();

    expect(body.data.email).toBeUndefined();
    expect(body.data.stripeCustomerId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("jane@example.com");
    expect(JSON.stringify(body)).not.toContain("cus_secretid123");

    expect(body.data.id).toBe("cust_1");
    expect(body.data.name).toBe("Jane Doe");
    expect(body.data.externalId).toBe("user_42");
    expect(body.data.country).toBe("US");
  });
});
