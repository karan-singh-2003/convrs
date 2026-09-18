import { prisma } from "@repo/db";

export type FunnelStepRow = {
  id: string;
  name: string;
  value: string;
  type: string;
  order: number;
};

export type FunnelRow = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  steps: FunnelStepRow[];
};

const stepSelect = {
  id: true,
  name: true,
  value: true,
  type: true,
  order: true,
} as const;

/** Workspace-scoped funnel list, shared by the dashboard's own /funnels
 * route (list-only path) and the public /api/v1/funnels route. */
export async function listWorkspaceFunnels(
  workspaceId: string,
  { page = 1, limit = 100 }: { page?: number; limit?: number } = {}
): Promise<{ rows: FunnelRow[]; hasMore: boolean }> {
  const skip = (page - 1) * limit;

  const funnels = await prisma.funnel.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit + 1,
    include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
  });

  const hasMore = funnels.length > limit;
  return { rows: funnels.slice(0, limit), hasMore };
}

/**
 * A single funnel scoped to `workspaceId` — the IDOR boundary. A funnel ID
 * belonging to another workspace resolves to null here, never a
 * cross-tenant read.
 */
export async function getWorkspaceFunnelById(
  workspaceId: string,
  funnelId: string
): Promise<FunnelRow | null> {
  return prisma.funnel.findFirst({
    where: { id: funnelId, workspaceId },
    include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
  });
}
