import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const funnelStepSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
  type: z.enum(["goal", "page_view"]),
  order: z.number().int().min(0).optional(),
});

const updateFunnelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  steps: z.array(funnelStepSchema).min(1).max(8).optional(),
});

export const PATCH = withWorkspace(
  async ({ req, workspace, params }) => {
    const funnelId = params.funnelId;
    const body = updateFunnelSchema.parse(await req.json());

    const existing = await prisma.funnel.findFirst({
      where: { id: funnelId, workspaceId: workspace.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.steps) {
        await tx.funnelStep.deleteMany({ where: { funnelId } });
      }

      return tx.funnel.update({
        where: { id: funnelId },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.steps
            ? {
                steps: {
                  create: body.steps.map((step, index) => ({
                    name: step.name.trim(),
                    value: step.value.trim(),
                    type: step.type,
                    order: step.order ?? index,
                  })),
                },
              }
            : {}),
        },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return NextResponse.json({ data: updated });
  },
  { requiredPermission: "workspace:write" }
);

export const DELETE = withWorkspace(
  async ({ workspace, params }) => {
    const funnelId = params.funnelId;

    const deleted = await prisma.funnel.deleteMany({
      where: {
        id: funnelId,
        workspaceId: workspace.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  },
  { requiredPermission: "workspace:write" }
);
