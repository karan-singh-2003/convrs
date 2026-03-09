import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { nanoid } from "@repo/utils";
import { NextResponse } from "next/server";

// POST /api/workspaces/[idOrSlug]/invite-code – regenerate the workspace invite code
export const POST = withWorkspace(
  async ({ workspace }) => {
    const newCode = nanoid(24);

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { inviteCode: newCode },
    });

    return NextResponse.json({ inviteCode: newCode });
  },
  { requiredPermission: "workspace:write" }
);
