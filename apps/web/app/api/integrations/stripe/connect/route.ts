import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

export async function POST(req: NextRequest) {
  const { apiKey, workspaceId } = await req.json();
  const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const workspaceIdentifier =
    typeof workspaceId === "string" ? workspaceId.trim() : "";

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

  const isRestrictedKey =
    normalizedApiKey.startsWith("rk_live_") ||
    normalizedApiKey.startsWith("rk_test_");
  const isSecretKey =
    normalizedApiKey.startsWith("sk_live_") ||
    normalizedApiKey.startsWith("sk_test_");

  if (!isRestrictedKey && !isSecretKey) {
    return NextResponse.json(
      { error: "Invalid key format. Use a Stripe key starting with rk_ or sk_." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(normalizedApiKey, {
    apiVersion: "2026-01-28.clover",
  });
  const appBaseUrl = process.env.BASE_URL || req.nextUrl.origin;

  if (!appBaseUrl?.startsWith("http://") && !appBaseUrl?.startsWith("https://")) {
    return NextResponse.json(
      { error: "Invalid app base URL configuration for Stripe webhooks." },
      { status: 500 }
    );
  }

  //  Step 1 — Verify key
  let accountId: string;
  try {
    const account = await stripe.accounts.retrieve();
    accountId = account.id;
    console.log("Retrieved Stripe account:", account.id, account.email);
  } catch (err) {
    const stripeError = err as Stripe.errors.StripeError;

    if (stripeError?.type === "StripeAuthenticationError") {
      return NextResponse.json(
        { error: "Stripe rejected this API key. Double-check the key and mode (test vs live)." },
        { status: 401 }
      );
    }

    if (stripeError?.type === "StripePermissionError") {
      // Restricted keys can fail `accounts.retrieve()` without KYC scope.
      // Stripe includes the account id in this specific permission error message.
      const accountIdMatch = stripeError?.message?.match(/account '([^']+)'/);
      const inferredAccountId = accountIdMatch?.[1];

      if (isRestrictedKey && inferredAccountId?.startsWith("acct_")) {
        accountId = inferredAccountId;
      } else {
        return NextResponse.json(
          {
            error:
              stripeError?.message ||
              "This restricted key is missing required permissions. Enable account read and webhook write permissions (or use an sk_ key).",
          },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: stripeError?.message || "Failed to verify Stripe API key",
        },
        { status: 400 }
      );
    }
  }


  //  Step 2 — Prevent duplicates
  const existing = await prisma.stripeIntegration.findFirst({
    where: {
      OR: [
        { stripeAccountId: accountId },
        { workspaceId: workspace.id },
      ],
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This workspace or Stripe account is already connected" },
      { status: 409 }
    );
  }

  //  Step 3 — Create webhook
  let webhook: Stripe.WebhookEndpoint;
  try {
    webhook = await stripe.webhookEndpoints.create({
      url: `${appBaseUrl}/api/stripe/webhook/${workspace.id}`,
      enabled_events: [
        "checkout.session.completed",
        "invoice.paid",
        "customer.subscription.created",
        "customer.subscription.updated",
        "charge.succeeded",
      ],
    });
  } catch (err) {
    const stripeError = err as Stripe.errors.StripeError;

    if (stripeError?.type === "StripePermissionError") {
      return NextResponse.json(
        {
          error:
            stripeError?.message ||
            "This key cannot create webhook endpoints. Add webhook write permission or use an sk_ key.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: stripeError?.message || "Failed to register webhook" },
      { status: 500 }
    );
  }

  //  Step 4 — Store encrypted
  await prisma.stripeIntegration.create({
    data: {
      workspaceId: workspace.id,
      stripeAccountId: accountId,
      apiKeyEncrypted: encrypt(normalizedApiKey),
      webhookId: webhook.id,
      webhookSecret: webhook.secret!, // whsec_...
    },
  });

  //  Step 5 — Trigger backfill (optional)
  //   await queue.add("stripe-backfill", { workspaceId, apiKey });

  return NextResponse.json({ success: true, accountId });
}
