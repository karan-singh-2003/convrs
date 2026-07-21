import { withWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@repo/db";
import { updateNotificationPreferencesSchema } from "@/lib/zod/schemas/notification-preferences";

// GET /api/workspaces/[idOrSlug]/notification-preferences
export const GET = withWorkspace(
  async ({ workspace }) => {
  
    const preference = await prisma.notificationPreference.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id },
      update: {},
    });

    return Response.json(preference);
  },
  { requiredPermission: "workspace:read" }
);

// PATCH /api/workspaces/[idOrSlug]/notification-preferences
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const body = await req.json();
    const data = updateNotificationPreferencesSchema.parse(body);

    const preference = await prisma.notificationPreference.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, ...data },
      update: data,
    });

    return Response.json(preference);
  },
  { requiredPermission: "workspace:write" }
);