// apps/web/app/api/integrations/paddle/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Paddle } from "@paddle/paddle-node-sdk";
import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

// Mirrors the "payment landed" + subscription lifecycle coverage we use for
// the other providers, using Paddle's entity.event_type naming.
const PADDLE_EVENTS = [
  "transaction.completed",
  "transaction.updated",
  "subscription.created",
  "subscription.updated",
  "adjustment.updated",
] as const;

export async function POST(req: NextRequest) {
  const { apiKey, workspaceId } = await req.json();
  const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const workspaceIdentifier =
    typeof workspaceId === "string" ? workspaceId.trim() : "";

  if (!normalizedApiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 });
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

  const paddle = new Paddle(normalizedApiKey);

  // Step 1 — Verify the key (cheap read call)
  let accountId = "default";
  try {
    const existingSettings = await paddle.notificationSettings.list();
    // Not all Paddle accounts expose an "account id" the same way Stripe
    // does — we just need a stable enough handle to prevent duplicates.
    accountId = existingSettings?.[0]?.id ?? "default";
  } catch (err: any) {
    const status = err?.code === "authentication_failed" || err?.status === 401 ? 401 : 400;
    if (status === 401) {
      return NextResponse.json(
        { error: "Paddle rejected this API key. Double-check the key and try again." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err?.detail || err?.message || "Failed to verify Paddle API key" },
      { status: 400 }
    );
  }

  // Step 2 — Prevent duplicates
  const existing = await prisma.integration.findFirst({
    where: { provider: "paddle", workspaceId: workspace.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This workspace already has a Paddle integration connected" },
      { status: 409 }
    );
  }

  const ingestionServerURL = "https://ingest.convrs.dev";

  // Step 3 — Create the notification destination (Paddle's webhook concept)
  let notificationSettingId: string;
  let webhookSecret: string;
  try {
    const notificationSetting = await paddle.notificationSettings.create({
      description: "Convrs revenue attribution",
      type: "url",
      destination: `${ingestionServerURL}/api/paddle/webhook/${workspace.id}`,
      subscribedEvents: [...PADDLE_EVENTS],
    });
    notificationSettingId = notificationSetting.id;
    webhookSecret = notificationSetting.endpointSecretKey!;
  } catch (err: any) {
    if (err?.code === "authentication_failed" || err?.status === 401) {
      return NextResponse.json(
        {
          error:
            "This key can't create notification destinations. Enable Notification Settings (Write) or use a different key.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: err?.detail || err?.message || "Failed to register webhook" },
      { status: 500 }
    );
  }

  // Step 4 — Store encrypted
  await prisma.integration.create({
    data: {
      workspaceId: workspace.id,
      provider: "paddle",
      externalAccountId: accountId,
      apiKeyEncrypted: encrypt(normalizedApiKey),
      webhookId: notificationSettingId,
      webhookSecret,
    },
  });

  return NextResponse.json({ success: true, accountId });
}