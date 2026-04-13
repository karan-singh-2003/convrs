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

const createFunnelSchema = z.object({
  name: z.string().min(1).max(100),
  steps: z.array(funnelStepSchema).min(1).max(8),
});

export const GET = withWorkspace(
  async ({ workspace }) => {
    const funnels = await prisma.funnel.findMany({
      where: { workspaceId: workspace.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: funnels });
  },
  { requiredPermission: "analytics.read" }
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const body = createFunnelSchema.parse(await req.json());

    const funnel = await prisma.funnel.create({
      data: {
        name: body.name.trim(),
        workspaceId: workspace.id,
        steps: {
          create: body.steps.map((step, index) => ({
            name: step.name.trim(),
            value: step.value.trim(),
            type: step.type,
            order: step.order ?? index,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: funnel }, { status: 201 });
  },
  { requiredPermission: "workspace:write" }
);
