// app/api/workspaces/[idOrSlug]/tracked-events/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const getTrackedEventsSchema = z.object({
  eventType: z.enum(["goals", "pageview", "identify", "exitlink"]).optional(),
});

export const GET = withWorkspace(
  async ({ req, workspace }) => {
    const { searchParams } = new URL(req.url);
    const { eventType } = getTrackedEventsSchema.parse({
      eventType: searchParams.get("eventType") ?? undefined,
    });

    const events = await prisma.trackedEvent.findMany({
      where: {
        workspaceId: workspace.id,
        ...(eventType && { eventType }),
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        eventName: true,
        eventType: true,
        trigger: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });

    return NextResponse.json({ data: events });
  },
  { requiredPermission: "workspace:read" }
);