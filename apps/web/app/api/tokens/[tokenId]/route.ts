import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SCOPES } from "@/lib/api/tokens/scopes";

const updateTokenSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  scopes: z.array(z.enum(SCOPES)).optional(),
});

// PATCH /api/tokens/[tokenId] — update name and/or scopes
export const PATCH = withWorkspace(
  async ({ req, params, workspace }) => {
    const { tokenId } = params;

    const existing = await prisma.restrictedToken.findFirst({
      where: { id: tokenId, workspaceId: workspace.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const body = updateTokenSchema.parse(await req.json());

    const updated = await prisma.restrictedToken.update({
      where: { id: tokenId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.scopes !== undefined && {
          scopes:
            body.scopes.length > 0 ? [...new Set(body.scopes)].join(" ") : null,
        }),
      },
    });

    return NextResponse.json(updated);
  },
  { requiredPermission: "tokens.write" }
);

// DELETE /api/tokens/[tokenId] — delete a token
export const DELETE = withWorkspace(
  async ({ params, workspace }) => {
    const { tokenId } = params;

    const existing = await prisma.restrictedToken.findFirst({
      where: { id: tokenId, workspaceId: workspace.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    await prisma.restrictedToken.delete({ where: { id: tokenId } });

    return NextResponse.json({ success: true });
  },
  { requiredPermission: "tokens.write" }
);
