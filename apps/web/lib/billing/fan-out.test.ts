import { describe, it, expect, vi } from "vitest";
import { fanOutSubscription, recomputeWorkspaceCount, INACTIVE_BASELINE } from "./fan-out";

/** Minimal fake transaction client that records the calls fan-out makes. */
function fakeTx(sub: Record<string, unknown>, workspaceCount = 3) {
  const calls: { op: string; args: unknown }[] = [];
  return {
    calls,
    subscription: {
      findUniqueOrThrow: vi.fn(async () => sub),
      update: vi.fn(async (args: unknown) => {
        calls.push({ op: "subscription.update", args });
        return sub;
      }),
    },
    workspace: {
      updateMany: vi.fn(async (args: unknown) => {
        calls.push({ op: "workspace.updateMany", args });
        return { count: 30 };
      }),
      count: vi.fn(async () => workspaceCount),
    },
  };
}

const SUB = {
  id: "sub_1",
  status: "active",
  planFamily: "growth",
  planTier: "t1m",
  tierEvents: 1_000_000,
  currentPeriodEnd: new Date("2027-01-01"),
  trialEndsAt: null,
  paymentFailedAt: null,
};

describe("fan-out", () => {
  it("INACTIVE_BASELINE is the uncovered cache, never touches `usage`", () => {
    expect(INACTIVE_BASELINE).toMatchObject({
      subscriptionId: null,
      subscriptionStatus: "inactive",
      planFamily: "standard",
      planTier: null,
      tierEvents: 0,
      usageLimit: 0,
    });
    expect(INACTIVE_BASELINE).not.toHaveProperty("usage");
  });

  it("fanOutSubscription copies absolute Subscription values onto workspaces (one updateMany)", async () => {
    const tx = fakeTx(SUB);
    await fanOutSubscription("sub_1", tx as never);

    const call = tx.calls.find((c) => c.op === "workspace.updateMany")!;
    expect(call).toBeTruthy();
    const { where, data } = call.args as { where: unknown; data: Record<string, unknown> };
    expect(where).toEqual({ subscriptionId: "sub_1" });
    // absolute values only — nothing incremented
    expect(data).toEqual({
      subscriptionStatus: "active",
      planFamily: "growth",
      planTier: "t1m",
      tierEvents: 1_000_000,
      usageLimit: 1_000_000, // D1: per-website limit == tierEvents
      currentPeriodEnd: SUB.currentPeriodEnd,
      freeTrialEndDate: null,
      paymentFailedAt: null,
    });
    expect(tx.workspace.updateMany).toHaveBeenCalledTimes(1);
  });

  it("recomputeWorkspaceCount SETs count (never increments)", async () => {
    const tx = fakeTx(SUB, 7);
    const n = await recomputeWorkspaceCount("sub_1", tx as never);
    expect(n).toBe(7);
    const upd = tx.calls.find((c) => c.op === "subscription.update")!;
    expect((upd.args as { data: unknown }).data).toEqual({ workspaceCount: 7 });
  });

  it("fanOutSubscription is idempotent — same output for repeated calls", async () => {
    const tx1 = fakeTx(SUB);
    const tx2 = fakeTx(SUB);
    await fanOutSubscription("sub_1", tx1 as never);
    await fanOutSubscription("sub_1", tx2 as never);
    const a = tx1.calls.find((c) => c.op === "workspace.updateMany")!.args;
    const b = tx2.calls.find((c) => c.op === "workspace.updateMany")!.args;
    expect(a).toEqual(b);
  });
});
