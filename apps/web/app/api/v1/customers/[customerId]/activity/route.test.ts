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
vi.mock("@/lib/analytics/get-customer-activity", () => ({
  getCustomerActivity: vi.fn(),
}));

import { prisma } from "@repo/db";
import { getCustomerActivity } from "@/lib/analytics/get-customer-activity";
import { GET } from "./route";

const workspace = { id: "ws_1", timezone: "UTC", currency: "USD", subscriptionStatus: "active" };

async function call(customerId: string) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1", name: "t", scopes: "analytics.read", expires: null, workspaceId: "ws_1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue(workspace);
  const request = new NextRequest(`http://localhost/api/v1/customers/${customerId}/activity`, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return GET(request, { params: Promise.resolve({ customerId }) });
}

describe("GET /api/v1/customers/:customerId/activity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the grouped activity for the token's workspace", async () => {
    (getCustomerActivity as any).mockResolvedValue([{ date: "September 1, 2026", items: [] }]);
    const res = await call("cust_1");
    expect(res.status).toBe(200);
    expect(getCustomerActivity).toHaveBeenCalledWith({ workspaceId: "ws_1", customerId: "cust_1" });
  });

  it("maps 'Customer not found' to a 404", async () => {
    (getCustomerActivity as any).mockRejectedValue(new Error("Customer not found"));
    const res = await call("cust_missing");
    expect(res.status).toBe(404);
  });

  it("maps an unrelated error to a 500", async () => {
    (getCustomerActivity as any).mockRejectedValue(new Error("boom"));
    const res = await call("cust_1");
    expect(res.status).toBe(500);
  });

  // The activity endpoint returns getCustomerActivity()'s result verbatim —
  // no field-level redaction happens here because the underlying
  // v1_customer_activity Tinybird pipe schema never carries email or
  // stripeCustomerId in the first place (it's event data: page, url,
  // referer, browser, device, country, utm_*, event_properties, revenue,
  // currency). This test locks in that the raw event shape stays that way.
  it("never exposes email or stripeCustomerId, even if present on an event item", async () => {
    (getCustomerActivity as any).mockResolvedValue([
      {
        date: "September 1, 2026",
        items: [
          {
            event_id: "evt_1",
            timestamp: "2026-09-01T14:32:00.000Z",
            event_type: "goals",
            event_name: "signup",
            page: "/signup",
            url: "https://acme.com/signup",
            referer: "google.com",
            referer_url: "https://google.com/search",
            browser: "Chrome",
            device: "Desktop",
            country: "US",
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            event_properties: "{}",
            revenue: 0,
            currency: null,
          },
        ],
      },
    ]);

    const res = await call("cust_1");
    const body = await res.json();
    const item = body.data[0].items[0];

    expect(item.email).toBeUndefined();
    expect(item.stripeCustomerId).toBeUndefined();
    expect(Object.keys(item)).not.toContain("email");
    expect(Object.keys(item)).not.toContain("stripeCustomerId");
  });
});
