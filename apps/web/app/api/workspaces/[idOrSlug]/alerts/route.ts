import { withWorkspace } from "@/lib/auth";
import { createAlertSchema } from "@/lib/zod/schemas/alert";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

const MAX_ALERTS_PER_WORKSPACE = 10;

export const GET = withWorkspace(
  async ({ workspace }) => {
    const alerts = await prisma.alert.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: alerts });
  },
  { requiredPermission: "workspace:read" }
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const payload = createAlertSchema.parse(await req.json());

    const existingCount = await prisma.alert.count({
      where: { workspaceId: workspace.id },
    });

    if (existingCount >= MAX_ALERTS_PER_WORKSPACE) {
      return NextResponse.json(
        { error: "Maximum alerts limit reached" },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        workspaceId: workspace.id,
        name: payload.name.trim(),
        trigger: payload.trigger.trim(),
        subject: payload.subject.trim(),
        content: payload.content.trim(),
      },
    });

    return NextResponse.json({ data: alert }, { status: 201 });
  },
  { requiredPermission: "workspace:write" }
);
