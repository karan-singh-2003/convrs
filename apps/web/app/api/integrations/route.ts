// apps/web/app/api/integrations/route.ts
// GET /api/integrations?workspaceId=... — list every connected revenue provider
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const workspaceIdentifier = req.nextUrl.searchParams
    .get("workspaceId")
    ?.trim();

  if (!workspaceIdentifier) {
    return NextResponse.json(
      { error: "Missing workspace id" },
      { status: 400 }
    );
  }

  const normalizedWorkspaceIdentifier = normalizeWorkspaceId(workspaceIdentifier);
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [
        { id: normalizedWorkspaceIdentifier },
        { slug: normalizedWorkspaceIdentifier },
      ],
    },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const integrations = await prisma.integration.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      workspaceId: true,
      provider: true,
      externalAccountId: true,
      webhookId: true,
      createdAt: true,
      // apiKeyEncrypted / webhookSecret deliberately never returned to the client
    },
  });

  return NextResponse.json({ integrations });
}