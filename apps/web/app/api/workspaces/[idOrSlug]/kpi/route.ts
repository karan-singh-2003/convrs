// app/api/workspaces/[idOrSlug]/kpi/route.ts
import { withWorkspace } from "@/lib/auth";
import { updateKpiSchema } from "@/lib/zod/schemas/kpi";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace }) => {
    return NextResponse.json({
      data: {
        kpiType: workspace.kpiType,
        kpiEventName: workspace.kpiEventName,
        kpiRevenueMetric: workspace.kpiRevenueMetric,
      },
    });
  },
  { requiredPermission: "workspace:read" }
);

export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { kpiType, kpiEventName, kpiRevenueMetric } = updateKpiSchema.parse(
      await req.json()
    );

    // The goal must be one of this workspace's tracked goals. A goal that has
    // never fired is still valid — "Add Goal" registers it as a TrackedEvent
    // up front — so this only rejects names the workspace doesn't know. It
    // must be an error status: this used to answer 200 without saving, and
    // the settings page reported that as a successful save.
    if (kpiType === "goal") {
      const exists = await prisma.trackedEvent.findFirst({
        where: {
          workspaceId: workspace.id,
          eventType: "goals",
          eventName: kpiEventName,
        },
        select: { id: true },
      });

      if (!exists) {
        return NextResponse.json(
          {
            error: `"${kpiEventName}" isn't a tracked goal in this workspace. Add it as a goal first.`,
          },
          { status: 422 }
        );
      }
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        kpiType,
        kpiEventName: kpiType === "goal" ? kpiEventName : null,
        kpiRevenueMetric:
          kpiType === "revenue" ? (kpiRevenueMetric ?? "revenue") : "revenue",
      },
      select: {
        kpiType: true,
        kpiEventName: true,
        kpiRevenueMetric: true,
      },
    });

    return NextResponse.json({ data: updated });
  },
  { requiredPermission: "workspace:write" }
);