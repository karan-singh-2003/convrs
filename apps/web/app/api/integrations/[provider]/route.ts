// apps/web/app/api/integrations/[provider]/route.ts
// GET /api/integrations/:provider?workspaceId=... — single integration
// DELETE /api/integrations/:provider — disconnect
import { prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";
import { authorizeWorkspaceForIntegrations } from "@/lib/api/integrations/authorize-workspace";

const VALID_PROVIDERS = ["stripe", "dodo", "polar", "lemonsqueezy", "paddle"] as const;
type ValidProvider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(value: string): value is ValidProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const workspaceIdentifier = req.nextUrl.searchParams.get("workspaceId") ?? undefined;

  const auth = await authorizeWorkspaceForIntegrations(
    workspaceIdentifier,
    "workspace:read"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: auth.workspaceId, provider } },
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

  // Unchanged request shape (workspaceId in the JSON body) — the existing
  // disconnect UI (ui/revenue/*) already sends it this way; authorizing here
  // rather than switching to withWorkspace() (which only reads params/query)
  // avoids having to touch those call sites.
  const auth = await authorizeWorkspaceForIntegrations(
    body.workspaceId,
    "workspace:write"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // TODO: for stripe/polar/dodo, fetch the integration first and call the
  // provider's API to actually delete the registered webhook endpoint
  // (using the stored webhookId) before deleting the row — otherwise Stripe
  // keeps sending events to a dead endpoint.
  const deleted = await prisma.integration.deleteMany({
    where: { workspaceId: auth.workspaceId, provider },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: `${provider} integration not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}