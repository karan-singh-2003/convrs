// apps/web/app/api/integrations/route.ts
// GET /api/integrations?workspaceId=... — list every connected revenue provider
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";
import { authorizeWorkspaceForIntegrations } from "@/lib/api/integrations/authorize-workspace";

export async function GET(req: NextRequest) {
  const workspaceIdentifier = req.nextUrl.searchParams.get("workspaceId") ?? undefined;

  const auth = await authorizeWorkspaceForIntegrations(
    workspaceIdentifier,
    "workspace:read"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const integrations = await prisma.integration.findMany({
    where: { workspaceId: auth.workspaceId },
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