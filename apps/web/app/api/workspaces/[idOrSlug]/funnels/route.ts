import { getSession } from "@/lib/auth";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
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

export const GET = async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const params = (await context.params) || {};
  const searchParams = new URL(req.url).searchParams;
  const idOrSlug =
    params.idOrSlug ||
    params.slug ||
    searchParams.get("workspaceId") ||
    searchParams.get("workspaceSlug");

  if (!idOrSlug) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const session = await getSession();
  const normalizedWorkspaceId = normalizeWorkspaceId(idOrSlug);
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: normalizedWorkspaceId }, { slug: idOrSlug }],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!session?.user?.id && !workspace.isPublic) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session?.user?.id && !workspace.isPublic) {
    const membership = await prisma.workspace.findFirst({
      where: {
        id: workspace.id,
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
};

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
