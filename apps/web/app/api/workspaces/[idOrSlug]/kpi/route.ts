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
      },
    });
  },
  { requiredPermission: "workspace:read" }
);

export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { kpiType, kpiEventName } = updateKpiSchema.parse(await req.json());

    // Optional but worth it: make sure the goal they're pinning actually exists
    // (or let it through if you want to support "goal that will fire soon")
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
            error:
              "This goal hasn't been tracked yet. It'll still be set, but no data will show until it starts firing.",
          },
          { status: 200 } // warn, don't block — matches your "goal not tracked yet" use case
        );
      }
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        kpiType,
        kpiEventName: kpiType === "goal" ? kpiEventName : null,
      },
      select: { kpiType: true, kpiEventName: true },
    });

    return NextResponse.json({ data: updated });
  },
  { requiredPermission: "workspace:write" }
);