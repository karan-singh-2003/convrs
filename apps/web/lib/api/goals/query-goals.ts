import { prisma } from "@repo/db";
import { TrackedEventType } from "@prisma/client";

export type GoalRow = {
  eventName: string;
  eventType: TrackedEventType;
  trigger: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

/**
 * The goal catalogue for a workspace — TrackedEvent rows of type "goals".
 * Shared by the dashboard's own /tracked-events route and the public
 * /api/v1/goals route so both read the same data the same way.
 */
export async function listWorkspaceGoals(
  workspaceId: string,
  { page = 1, limit = 100 }: { page?: number; limit?: number } = {}
): Promise<{ rows: GoalRow[]; hasMore: boolean }> {
  const skip = (page - 1) * limit;

  const rows = await prisma.trackedEvent.findMany({
    where: { workspaceId, eventType: "goals" },
    orderBy: { lastSeenAt: "desc" },
    skip,
    take: limit + 1,
    select: {
      eventName: true,
      eventType: true,
      trigger: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
  });

  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), hasMore };
}
