import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    workspaceInvite: { findUnique: vi.fn() },
    trackedEvent: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/auth/utils", () => ({ getSession: vi.fn() }));

import { prisma } from "@repo/db";
import { getSession } from "@/lib/auth/utils";
import { PATCH } from "./route";

const SESSION = { user: { id: "user_1", name: "T", email: "t@example.com" } };

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/workspaces/acme/kpi", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ idOrSlug: "acme" }) }
  );
}

describe("PATCH /api/workspaces/[idOrSlug]/kpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue(SESSION);
    (prisma.workspace.findUnique as any).mockResolvedValue({
      id: "ws_1",
      slug: "acme",
      subscriptionStatus: "active",
      freeTrialEndDate: null,
      paymentFailedAt: null,
      kpiType: "revenue",
      kpiEventName: null,
      kpiRevenueMetric: "revenue",
      users: [{ role: "owner" }],
    });
    (prisma.workspace.update as any).mockImplementation(async ({ data }: any) => data);
  });

  it("saves a tracked goal that has zero events", async () => {
    // "Add Goal" registers the TrackedEvent before the goal ever fires.
    (prisma.trackedEvent.findFirst as any).mockResolvedValue({ id: "te_1" });

    const res = await patch({ kpiType: "goal", kpiEventName: "zero_goal" });

    expect(res.status).toBe(200);
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { kpiType: "goal", kpiEventName: "zero_goal", kpiRevenueMetric: "revenue" },
      })
    );
    expect((await res.json()).data).toEqual({
      kpiType: "goal",
      kpiEventName: "zero_goal",
      kpiRevenueMetric: "revenue",
    });
  });

  it("rejects a goal the workspace doesn't track with an error status, and saves nothing", async () => {
    (prisma.trackedEvent.findFirst as any).mockResolvedValue(null);

    const res = await patch({ kpiType: "goal", kpiEventName: "no_such_goal" });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no_such_goal/);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it("saves the MRR revenue metric and clears any goal", async () => {
    const res = await patch({ kpiType: "revenue", kpiRevenueMetric: "mrr" });

    expect(res.status).toBe(200);
    expect(prisma.trackedEvent.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { kpiType: "revenue", kpiEventName: null, kpiRevenueMetric: "mrr" },
      })
    );
  });
});
