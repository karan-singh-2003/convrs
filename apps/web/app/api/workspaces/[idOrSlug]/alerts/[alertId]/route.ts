import { withWorkspace } from "@/lib/auth";
import { updateAlertSchema } from "@/lib/zod/schemas/alert";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const PATCH = withWorkspace(
  async ({ req, workspace, params }) => {
    const alertId = params.alertId;
    const payload = updateAlertSchema.parse(await req.json());

    const existing = await prisma.alert.findFirst({
      where: { id: alertId, workspaceId: workspace.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        ...(payload.name ? { name: payload.name.trim() } : {}),
        ...(payload.trigger ? { trigger: payload.trigger.trim() } : {}),
        ...(payload.subject ? { subject: payload.subject.trim() } : {}),
        ...(payload.content ? { content: payload.content.trim() } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  },
  { requiredPermission: "workspace:write" }
);

export const DELETE = withWorkspace(
  async ({ workspace, params }) => {
    const alertId = params.alertId;

    const deleted = await prisma.alert.deleteMany({
      where: {
        id: alertId,
        workspaceId: workspace.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  },
  { requiredPermission: "workspace:write" }
);
