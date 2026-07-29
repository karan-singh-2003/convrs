// FILE: app/api/[slug]/social/keywords/[id]/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { z } from "zod";

const updateKeywordSchema = z.object({
  isActive: z.boolean().optional(),
});

export const PATCH = withWorkspace(
  async ({ req, params, workspace }) => {
    const body = await req.json();
    const { isActive } = updateKeywordSchema.parse(body);

    const updated = await prisma.socialKeyword.updateMany({
      where: { id: params.id, workspaceId: workspace.id },
      data: { ...(typeof isActive === "boolean" ? { isActive } : {}) },
    });

    if (updated.count === 0) {
      return new Response(JSON.stringify({ error: "Keyword not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);

export const DELETE = withWorkspace(
  async ({ params, workspace }) => {
    await prisma.socialKeyword.deleteMany({
      where: { id: params.id, workspaceId: workspace.id },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);