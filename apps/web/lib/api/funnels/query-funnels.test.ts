import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/db", () => ({
  prisma: { funnel: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

import { prisma } from "@repo/db";
import { listWorkspaceFunnels, getWorkspaceFunnelById } from "./query-funnels";

describe("listWorkspaceFunnels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes to the given workspace and orders steps", async () => {
    (prisma.funnel.findMany as any).mockResolvedValue([]);
    await listWorkspaceFunnels("ws_1");
    expect(prisma.funnel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        include: { steps: { orderBy: { order: "asc" }, select: expect.any(Object) } },
      })
    );
  });

  it("computes hasMore via limit+1", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, steps: [] }));
    (prisma.funnel.findMany as any).mockResolvedValue(rows);
    const result = await listWorkspaceFunnels("ws_1", { page: 1, limit: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });

  it("returns empty with hasMore: false when there are no funnels", async () => {
    (prisma.funnel.findMany as any).mockResolvedValue([]);
    const result = await listWorkspaceFunnels("ws_1");
    expect(result).toEqual({ rows: [], hasMore: false });
  });
});

describe("getWorkspaceFunnelById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes the lookup by workspaceId (IDOR boundary)", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue(null);
    await getWorkspaceFunnelById("ws_1", "f_other_workspace");
    expect(prisma.funnel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "f_other_workspace", workspaceId: "ws_1" } })
    );
  });

  it("returns null for a nonexistent funnel", async () => {
    (prisma.funnel.findFirst as any).mockResolvedValue(null);
    expect(await getWorkspaceFunnelById("ws_1", "missing")).toBeNull();
  });
});
