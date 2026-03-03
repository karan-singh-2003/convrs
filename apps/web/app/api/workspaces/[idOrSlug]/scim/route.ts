import { withWorkspace } from "@/lib/auth";
import { jackson } from "@/lib/jackson";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const createDirectorySchema = z.object({
  provider: z.enum(["okta-scim-v2", "azure-scim-v2", "google"]).optional(),
  currentDirectoryId: z.string().min(1).optional(),
});

const deleteDirectorySchema = z.object({
  directoryId: z.string().min(1),
});

// GET /api/workspaces/[idOrSlug]/scim – get all SCIM directories
export const GET = withWorkspace(
  async ({ workspace }) => {
    const { directorySyncController } = await jackson();

    const { data, error } =
      await directorySyncController.directories.getByTenantAndProduct(
        workspace.id,
        "Boilercode"
      );
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      directories: data,
    });
  },
  {
    requiredPermission: "workspace:read",
  }
);

// POST /api/workspaces/[idOrSlug]/scim – create a new SCIM directory
export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const { provider = "okta-scim-v2", currentDirectoryId } =
      createDirectorySchema.parse(await req.json());

    const { directorySyncController } = await jackson();

    const [directoryResponse, _] = await Promise.all([
      directorySyncController.directories.create({
        name: "Boilercode SCIM Directory",
        tenant: workspace.id,
        product: "Boilercode",
        type: provider,
      }),
      currentDirectoryId &&
        directorySyncController.directories.delete(currentDirectoryId),
    ]);

    return NextResponse.json({
      directories: [directoryResponse.data],
    });
  },
  {
    requiredPermission: "workspace:write",
  }
);

// DELETE /api/workspaces/[idOrSlug]/scim – delete a SCIM directory
export const DELETE = withWorkspace(
  async ({ searchParams }) => {
    const { directoryId } = deleteDirectorySchema.parse(searchParams);

    const { directorySyncController } = await jackson();

    const { error, data } =
      await directorySyncController.directories.delete(directoryId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  },
  {
    requiredPermission: "workspace:write",
  }
);
