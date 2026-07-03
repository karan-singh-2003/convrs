// apps/web/app/api/integrations/[provider]/route.ts
// GET /api/integrations/:provider?workspaceId=... — single integration
// DELETE /api/integrations/:provider — disconnect
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

const VALID_PROVIDERS = ["stripe", "dodo", "polar", "lemonsqueezy", "paddle"] as const;
type ValidProvider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(value: string): value is ValidProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

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

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: provider } },
    select: {
      id: true,
      workspaceId: true,
      provider: true,
      externalAccountId: true,
      webhookId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ integration });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

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

  // TODO: for stripe/polar/dodo, fetch the integration first and call the
  // provider's API to actually delete the registered webhook endpoint
  // (using the stored webhookId) before deleting the row — otherwise Stripe
  // keeps sending events to a dead endpoint.
  const deleted = await prisma.integration.deleteMany({
    where: { workspaceId, provider: provider },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: `${provider} integration not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}