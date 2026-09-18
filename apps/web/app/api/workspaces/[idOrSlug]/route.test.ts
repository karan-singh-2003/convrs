import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Billing audit fixes covered here:
//  - the workspace GET/DELETE routes must stay reachable even when the
//    workspace has no active subscription/trial (skipEntitlementCheck: true)
//  - GET must expose `subscription.hasPaymentMethod` derived from
//    `Subscription.dodoSubscriptionId` (never from `status` alone), and must
//    never leak the raw Dodo subscription id to the client, so the billing
//    page can hide "Manage billing & invoices" / cancel controls for a
//    cardless trial that has no payment method on file.

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    workspaceInvite: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/utils", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/workspaces/delete-workspace", () => ({ deleteWorkspace: vi.fn() }));

import { prisma } from "@repo/db";
import { getSession } from "@/lib/auth/utils";
import { GET, DELETE } from "./route";

function req() {
  return new NextRequest("http://localhost/api/workspaces/ws_1");
}

const SESSION = { user: { id: "user_1", name: "T", email: "t@example.com" } };

function workspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ws_1",
    slug: "acme",
    name: "Acme",
    subscriptionId: "sub_1",
    subscriptionStatus: "inactive",
    freeTrialEndDate: null,
    paymentFailedAt: null,
    ssoEnforcedAt: null,
    inviteCode: null,
    createdAt: new Date(),
    kpiType: "revenue",
    kpiEventName: null,
    users: [{ role: "owner" }],
    ...overrides,
  };
}

describe("GET /api/workspaces/[idOrSlug] — hasPaymentMethod + entitlement bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue(SESSION);
  });

  it("hasPaymentMethod is false for a cardless trial (dodoSubscriptionId null) even though status is 'trialing'", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "trialing" }),
    );
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "sub_1",
      planFamily: "standard",
      planTier: "t10k",
      billingInterval: "month",
      status: "trialing",
      workspaceCount: 1,
      maxWorkspaces: 1,
      currentPeriodEnd: null,
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      cancelAtPeriodEnd: false,
      dodoSubscriptionId: null,
    });

    const res = await GET(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription.hasPaymentMethod).toBe(false);
    expect(body.subscription.dodoSubscriptionId).toBeUndefined();
  });

  it("hasPaymentMethod is true once the subscription is bound to a real Dodo subscription", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "active" }),
    );
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "sub_1",
      planFamily: "standard",
      planTier: "t10k",
      billingInterval: "month",
      status: "active",
      workspaceCount: 1,
      maxWorkspaces: 1,
      currentPeriodEnd: new Date(),
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      dodoSubscriptionId: "sub_dodo_123",
    });

    const res = await GET(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription.hasPaymentMethod).toBe(true);
    expect(body.subscription.dodoSubscriptionId).toBeUndefined();
  });

  it("stays reachable for a workspace with an inactive/no subscription (skipEntitlementCheck)", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionId: null, subscriptionStatus: "inactive" }),
    );

    const res = await GET(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toBeNull();
  });
});

describe("DELETE /api/workspaces/[idOrSlug] — stays reachable when unentitled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue(SESSION);
  });

  it("does not require an active subscription to delete an unwanted workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionId: null, subscriptionStatus: "inactive" }),
    );

    const res = await DELETE(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
  });
});
