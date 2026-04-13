import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

async function resolveWorkspaceId(workspaceIdentifier: string) {
  const normalizedWorkspaceIdentifier = normalizeWorkspaceId(
    workspaceIdentifier.trim()
  );

  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [
        { id: normalizedWorkspaceIdentifier },
        { slug: normalizedWorkspaceIdentifier },
      ],
    },
    select: { id: true },
  });

  return workspace?.id;
}

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

  const workspaceId = await resolveWorkspaceId(workspaceIdentifier);

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const integration = await prisma.stripeIntegration.findUnique({
    where: { workspaceId },
    select: {
      id: true,
      workspaceId: true,
      stripeAccountId: true,
      webhookId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ integration });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { workspaceId?: string };
  const workspaceIdentifier = body.workspaceId?.trim();

  if (!workspaceIdentifier) {
    return NextResponse.json(
      { error: "Missing workspace id" },
      { status: 400 }
    );
  }

  const workspaceId = await resolveWorkspaceId(workspaceIdentifier);

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const deleted = await prisma.stripeIntegration.deleteMany({
    where: { workspaceId },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Stripe integration not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
