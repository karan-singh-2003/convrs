import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/db", () => ({
  prisma: { trackedEvent: { findMany: vi.fn() } },
}));

import { prisma } from "@repo/db";
import { listWorkspaceGoals } from "./query-goals";

describe("listWorkspaceGoals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always filters to eventType=goals for the given workspace", async () => {
    (prisma.trackedEvent.findMany as any).mockResolvedValue([]);
    await listWorkspaceGoals("ws_1");
    expect(prisma.trackedEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws_1", eventType: "goals" } })
    );
  });

  it("computes hasMore via a limit+1 fetch, without a separate count query", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ eventName: `g${i}` }));
    (prisma.trackedEvent.findMany as any).mockResolvedValue(rows);

    const result = await listWorkspaceGoals("ws_1", { page: 1, limit: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(prisma.trackedEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 3 })
    );
  });

  it("reports hasMore: false on the last page", async () => {
    (prisma.trackedEvent.findMany as any).mockResolvedValue([{ eventName: "g0" }]);
    const result = await listWorkspaceGoals("ws_1", { page: 1, limit: 2 });
    expect(result.hasMore).toBe(false);
  });

  it("applies skip for page > 1", async () => {
    (prisma.trackedEvent.findMany as any).mockResolvedValue([]);
    await listWorkspaceGoals("ws_1", { page: 3, limit: 10 });
    expect(prisma.trackedEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 11 })
    );
  });
});
