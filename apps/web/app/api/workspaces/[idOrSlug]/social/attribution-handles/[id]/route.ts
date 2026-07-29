// FILE: app/api/[slug]/social/attribution-handles/[id]/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";

export const DELETE = withWorkspace(
  async ({ params, workspace }) => {
    await prisma.socialAttributionHandle.deleteMany({
      where: { id: params.id, workspaceId: workspace.id },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);