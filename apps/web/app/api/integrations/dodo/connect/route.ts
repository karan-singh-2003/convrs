// apps/web/app/api/integrations/dodo/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

// Mirrors the "payment landed" + subscription lifecycle coverage we use for
// the other providers, using Dodo's event catalog.
const DODO_EVENTS = [
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
  "subscription.renewed",
  "subscription.cancelled",
] as const;

export async function POST(req: NextRequest) {
  const { apiKey, webhookSecret, workspaceId } = await req.json();
  const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const normalizedWebhookSecret =
    typeof webhookSecret === "string" ? webhookSecret.trim() : "";
  const workspaceIdentifier =
    typeof workspaceId === "string" ? workspaceId.trim() : "";

  if (!normalizedApiKey && !normalizedWebhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signing secret" },
      { status: 400 }
    );
  }

  if (!workspaceIdentifier) {
    return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
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

  // Step 2 — Prevent duplicates
  const existing = await prisma.integration.findFirst({
    where: { provider: "dodo", workspaceId: workspace.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This workspace already has a Dodo Payments integration connected" },
      { status: 409 }
    );
  }

  const ingestionServerURL = "https://ingest.convrs.dev";
  const webhookUrl = `${ingestionServerURL}/api/dodo/webhook/${workspace.id}`;

  // If no API key was given, fall back to the original manual flow: the
  // person created the webhook by hand in the Dodo dashboard and is just
  // pasting the secret it generated.
  if (!normalizedApiKey) {
    await prisma.integration.create({
      data: {
        workspaceId: workspace.id,
        provider: "dodo",
        externalAccountId: null,
        apiKeyEncrypted: null,
        webhookId: null,
        webhookSecret: normalizedWebhookSecret,
      },
    });

    return NextResponse.json({ success: true, accountId: null });
  }

  // Otherwise, do it Stripe-style: use the key to create the webhook
  // endpoint ourselves and fetch its signing secret.
  const dodo = new DodoPayments({
    bearerToken: normalizedApiKey,
    environment: normalizedApiKey.startsWith("test_") ? "test_mode" : "live_mode",
  });

  let webhookId: string;
  let resolvedSecret: string = normalizedWebhookSecret;
  try {
    const webhook = await dodo.webhooks.create({
      url: webhookUrl,
      description: "Convrs revenue attribution",
      filter_types: [...DODO_EVENTS],
    });
    webhookId = webhook.id;

    const secretRes = await dodo.webhooks.retrieveSecret(webhookId);
    if (secretRes?.secret) {
      resolvedSecret = secretRes.secret;
    }
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode;
    if (status === 401) {
      return NextResponse.json(
        { error: "Dodo Payments rejected this API key. Double-check it and try again." },
        { status: 401 }
      );
    }
    if (status === 403) {
      return NextResponse.json(
        { error: "This key can't create webhooks on this account." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Failed to register webhook" },
      { status: 500 }
    );
  }

  if (!resolvedSecret) {
    return NextResponse.json(
      {
        error:
          "Webhook was created but no signing secret could be retrieved. Paste it manually from the Dodo dashboard.",
      },
      { status: 500 }
    );
  }

  // Step 4 — Store encrypted
  await prisma.integration.create({
    data: {
      workspaceId: workspace.id,
      provider: "dodo",
      externalAccountId: null,
      apiKeyEncrypted: encrypt(normalizedApiKey),
      webhookId,
      webhookSecret: resolvedSecret,
    },
  });

  return NextResponse.json({ success: true, accountId: null });
}