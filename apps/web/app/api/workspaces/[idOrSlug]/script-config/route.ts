import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import * as z from "zod/v4";

const updateScriptConfigSchema = z.object({
  blockedHostnames: z.array(z.string()).optional(),
  blockedIpAddresses: z.array(z.string()).optional(),
  blockedPages: z.array(z.string()).optional(),
});

function normalizeList(values: string[]) {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

// GET /api/workspaces/[idOrSlug]/script-config - get domain + project token for script snippet
export const GET = withWorkspace(
  async ({ workspace }) => {
    return NextResponse.json({
      domain: workspace.domain,
      projectToken: workspace.projectToken,
      blockedHostnames: workspace.blockedHostnames || [],
      blockedIpAddresses: workspace.blockedIpAddresses || [],
      blockedPages: workspace.blockedPages || [],
    });
  },
  {
    requiredPermission: "workspace:read",
  }
);

// PATCH /api/workspaces/[idOrSlug]/script-config - update tracking filters
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const payload = await updateScriptConfigSchema.parseAsync(await req.json());

    const updatedWorkspace = await prisma.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        ...(payload.blockedHostnames !== undefined && {
          blockedHostnames: normalizeList(payload.blockedHostnames),
        }),
        ...(payload.blockedIpAddresses !== undefined && {
          blockedIpAddresses: normalizeList(payload.blockedIpAddresses),
        }),
        ...(payload.blockedPages !== undefined && {
          blockedPages: normalizeList(payload.blockedPages),
        }),
      },
      select: {
        domain: true,
        projectToken: true,
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
      },
    });

    return NextResponse.json(updatedWorkspace);
  },
  {
    requiredPermission: "workspace:write",
  }
);
