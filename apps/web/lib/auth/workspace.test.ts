import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Billing audit fix (highest-priority item): withWorkspace() previously only
// checked session + workspace-membership + RBAC permission — never
// subscription entitlement — so a user whose workspace had no active
// subscription/trial was blocked from dashboard *pages* (hasWorkspaceAccess,
// checked once in the [slug] layout) but could still call any
// withWorkspace()-gated API route directly. These tests cover the new
// entitlement gate added to the shared wrapper itself.

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: vi.fn() },
    workspaceInvite: { findUnique: vi.fn() },
  },
}));
vi.mock("./utils", () => ({ getSession: vi.fn() }));

import { prisma } from "@repo/db";
import { getSession } from "./utils";
import { withWorkspace } from "./workspace";

function req() {
  return new NextRequest("http://localhost/api/workspaces/ws_1/customers");
}

const BASE_SESSION = { user: { id: "user_1", name: "T", email: "t@example.com" } };

function workspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ws_1",
    slug: "acme",
    subscriptionStatus: "inactive",
    freeTrialEndDate: null,
    paymentFailedAt: null,
    users: [{ role: "owner" }],
    ...overrides,
  };
}

describe("withWorkspace entitlement gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue(BASE_SESSION);
  });

  it("blocks an inactive/no-subscription workspace with 402 upgrade_required, never calling the handler", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(workspaceRow({ subscriptionStatus: "inactive" }));
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("upgrade_required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks a canceled subscription", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(workspaceRow({ subscriptionStatus: "canceled" }));
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks an expired trial (status still 'trialing' but freeTrialEndDate has passed)", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "trialing", freeTrialEndDate: new Date(Date.now() - 1000) }),
    );
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows an active subscription", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(workspaceRow({ subscriptionStatus: "active" }));
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows an unexpired trial", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "trialing", freeTrialEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24) }),
    );
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows past_due within the 7-day grace window", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "past_due", paymentFailedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) }),
    );
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("blocks past_due once the 7-day grace window has elapsed", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "past_due", paymentFailedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8) }),
    );
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows a scheduled-cancellation ('canceling') subscription — access continues until period end", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(workspaceRow({ subscriptionStatus: "canceling" }));
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("skipEntitlementCheck:true (billing-recovery routes) bypasses the gate for an inactive workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(workspaceRow({ subscriptionStatus: "inactive" }));
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:read", skipEntitlementCheck: true });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("permission (403) is still checked before entitlement, and still blocks regardless of subscription state", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(
      workspaceRow({ subscriptionStatus: "active", users: [{ role: "viewer" }] }),
    );
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const route = withWorkspace(handler, { requiredPermission: "workspace:write" });

    const res = await route(req(), { params: Promise.resolve({ idOrSlug: "ws_1" }) });
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
