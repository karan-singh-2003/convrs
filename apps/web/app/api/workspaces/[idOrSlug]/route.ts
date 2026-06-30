import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { withSession } from "@/lib/auth/session";
import { prisma } from "@repo/db";
import {
  createWorkspaceSchema,
  WorkspaceSchema,
} from "@/lib/zod/schemas/workspaces";
import { withWorkspace } from "@/lib/auth";
import { R2_URL } from "@repo/utils";
import { nanoid } from "@repo/utils";
import { storage } from "@/lib/storage";
import { waitUntil } from "@vercel/functions";
import * as z from "zod/v4";
import { jackson } from "@/lib/jackson";
import { deleteWorkspace } from "@/lib/api/workspaces/delete-workspace";

const updateWorkspaceSchema = createWorkspaceSchema
  .extend({
    enforceSAML: z.boolean().optional(),
    isPublic: z.boolean().optional(),
  })
  .partial();

// GET /api/workspaces/[idOrSlug] – get a specific workspace by id or slug
export const GET = withWorkspace(
  async ({ workspace }) => {
    return NextResponse.json({
      ...WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      }),
    });
  },
  {
    requiredPermission: "workspace:read",
  }
);

// PATCH /api/workspaces/[idOrSlug] - update a specific workspace by id or slug
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { name, slug, enforceSAML, isPublic, timezone } =
      await updateWorkspaceSchema.parseAsync(await req.json());

    if (enforceSAML) {
      const apiController = (await jackson()).apiController;
      const connections = await apiController.getConnections({
        tenant: workspace.id,
        product: "Boilercode",
      });

      if (connections.length === 0) {
        return new Response(
          JSON.stringify({
            error:
              "Cannot enable SAML enforcement without an active SAML connection. Please set up a SAML connection first.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(timezone && { timezone }),
        ...(enforceSAML !== undefined && {
          ssoEnforcedAt: enforceSAML ? new Date() : null,
        }),
        ...(isPublic !== undefined && {
          isPublic,
          publicId: isPublic ? (workspace.publicId ?? nanoid(12)) : null,
        }),
      },
      include: {
        users: true,
      },
    });

    const res = WorkspaceSchema.parse({
      ...updatedWorkspace,
      id: prefixWorkspaceId(updatedWorkspace.id),
    });
    return NextResponse.json(res);
  },
  { requiredPermission: "workspace:write" }
);

// DELETE /api/workspaces/[idOrSlug] – delete a specific project
export const DELETE = withWorkspace(
  async ({ workspace }) => {
    await deleteWorkspace(workspace);

    return NextResponse.json(workspace);
  },
  {
    requiredPermission: "workspace:write",
  }
);
