import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    customer: { findMany: vi.fn() },
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

async function call(qs = "", scopes = "analytics.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/customers${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/customers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires analytics.read", async () => {
    const res = await call("", "goals.read");
    expect(res.status).toBe(403);
  });

  it("scopes the query to the token's own workspace", async () => {
    (prisma.customer.findMany as any).mockResolvedValue([]);
    await call();
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws_1" } })
    );
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });

  it("caps limit at 500", async () => {
    (prisma.customer.findMany as any).mockResolvedValue([]);
    const res = await call("?limit=99999");
    expect(res.status).toBe(400); // zod rejects > MAX_PAGE_LIMIT
  });

  it("redacts email and stripeCustomerId while keeping the other legitimate fields", async () => {
    (prisma.customer.findMany as any).mockResolvedValue([
      {
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
      },
    ]);

    const res = await call();
    const body = await res.json();
    const customer = body.data[0];

    expect(customer.email).toBeUndefined();
    expect(customer.stripeCustomerId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("jane@example.com");
    expect(JSON.stringify(body)).not.toContain("cus_secretid123");

    // legitimate analytics/customer fields must still be present
    expect(customer.id).toBe("cust_1");
    expect(customer.name).toBe("Jane Doe");
    expect(customer.externalId).toBe("user_42");
    expect(customer.country).toBe("US");
    expect(customer.sales).toBe(2);
    expect(customer.saleAmount).toBe(9800);
    expect(customer.device).toBe("Desktop");
    expect(customer.browser).toBe("Chrome");
  });
});
