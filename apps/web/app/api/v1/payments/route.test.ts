import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
    payment: { findMany: vi.fn() },
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
const rawPayment = {
  id: "pay_1",
  amount: 4900,
  currency: "USD",
  provider: "stripe",
  isRecurring: true,
  billingInterval: "month",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  attributionStatus: "attributed",
  customerId: "cust_1",
  // sensitive fields that must never appear in the response, even if a
  // future select-statement change accidentally widens the query
  externalSessionId: "cs_test_secret",
  externalPaymentId: "pi_secret",
  externalEventId: "evt_secret",
  customerEmail: "someone@example.com",
};

async function call(qs = "", scopes = "payments.read") {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes, expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/payments${qs}`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({}) });
}

describe("GET /api/v1/payments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires payments.read (analytics.read alone is not enough)", async () => {
    const res = await call("", "analytics.read");
    expect(res.status).toBe(403);
  });

  it("only selects the redacted field set from Prisma", async () => {
    (prisma.payment.findMany as any).mockResolvedValue([]);
    await call();
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        select: {
          id: true,
          amount: true,
          currency: true,
          provider: true,
          isRecurring: true,
          billingInterval: true,
          createdAt: true,
          attributionStatus: true,
          customerId: true,
        },
      })
    );
  });

  it("never returns provider identifiers or customer email even if the query returned them", async () => {
    (prisma.payment.findMany as any).mockResolvedValue([rawPayment]);
    const res = await call();
    const body = await res.json();
    const row = body.data[0];

    expect(row).toEqual({
      id: "pay_1",
      amount: 4900,
      currency: "USD",
      provider: "stripe",
      isRecurring: true,
      billingInterval: "month",
      createdAt: "2026-09-01T00:00:00.000Z",
      attributionStatus: "attributed",
      customerId: "cust_1",
    });
    expect(row.externalSessionId).toBeUndefined();
    expect(row.externalPaymentId).toBeUndefined();
    expect(row.externalEventId).toBeUndefined();
    expect(row.customerEmail).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("example.com");
  });

  it("paginates with a hasMore heuristic", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...rawPayment, id: `pay_${i}` }));
    (prisma.payment.findMany as any).mockResolvedValue(rows); // limit+1 = 3 rows for limit=2
    const res = await call("?limit=2");
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, limit: 2, hasMore: true });
  });

  it("rejects a mismatched websiteId (IDOR)", async () => {
    const res = await call("?websiteId=ws_other");
    expect(res.status).toBe(403);
  });
});
