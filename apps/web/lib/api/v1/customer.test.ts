import { describe, it, expect } from "vitest";
import { toPublicCustomer } from "./customer";
import type { CustomerRow } from "@/lib/api/customers/query-customers";

const fullCustomer: CustomerRow = {
  id: "cust_1",
  name: "Jane Doe",
  email: "jane@example.com",
  avatar: null,
  externalId: "user_42",
  stripeCustomerId: "cus_secretid123",
  country: "US",
  sales: 2,
  saleAmount: 9800,
  firstSaleAt: "2026-03-01T00:00:00.000Z",
  subscriptionCanceledAt: null,
  createdAt: "2026-02-20T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  device: "Desktop",
  browser: "Chrome",
};

describe("toPublicCustomer", () => {
  it("strips email and stripeCustomerId", () => {
    const result = toPublicCustomer(fullCustomer) as any;
    expect(result.email).toBeUndefined();
    expect(result.stripeCustomerId).toBeUndefined();
    expect("email" in result).toBe(false);
    expect("stripeCustomerId" in result).toBe(false);
  });

  it("preserves every other legitimate field unchanged", () => {
    const result = toPublicCustomer(fullCustomer);
    expect(result).toEqual({
      id: "cust_1",
      name: "Jane Doe",
      avatar: null,
      externalId: "user_42",
      country: "US",
      sales: 2,
      saleAmount: 9800,
      firstSaleAt: "2026-03-01T00:00:00.000Z",
      subscriptionCanceledAt: null,
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      device: "Desktop",
      browser: "Chrome",
    });
  });
});
