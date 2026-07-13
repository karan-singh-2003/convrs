// apps/web/app/api/integrations/lemonsqueezy/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

const LEMONSQUEEZY_API = "https://api.lemonsqueezy.com/v1";

// order_created / order_refunded cover one-time purchases + refunds.
// subscription_payment_success / subscription_payment_failed cover renewals.
const LEMONSQUEEZY_EVENTS = [
    "order_created",
    "order_refunded",
    "subscription_payment_success",
    "subscription_payment_failed",
] as const;

function lemonSqueezyHeaders(apiKey: string) {
    return {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
    };
}

export async function POST(req: NextRequest) {
    const { apiKey, storeId, workspaceId } = await req.json();
    const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    const normalizedStoreId = typeof storeId === "string" ? storeId.trim() : "";
    const workspaceIdentifier =
        typeof workspaceId === "string" ? workspaceId.trim() : "";

    if (!normalizedApiKey || !normalizedStoreId) {
        return NextResponse.json(
            { error: "Missing store ID or API key" },
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

    // Step 1 — Verify the key + confirm it can see this store
    let storeName: string | undefined;
    try {
        const storeRes = await fetch(`${LEMONSQUEEZY_API}/stores/${normalizedStoreId}`, {
            headers: lemonSqueezyHeaders(normalizedApiKey),
        });

        if (storeRes.status === 401 || storeRes.status === 403) {
            return NextResponse.json(
                { error: "Lemon Squeezy rejected this API key. Double-check it and try again." },
                { status: 401 }
            );
        }
        if (storeRes.status === 404) {
            return NextResponse.json(
                { error: "Could not find a store with that Store ID." },
                { status: 404 }
            );
        }
        if (!storeRes.ok) {
            const body = await storeRes.json().catch(() => null);
            return NextResponse.json(
                { error: body?.errors?.[0]?.detail || "Failed to verify Lemon Squeezy store" },
                { status: 400 }
            );
        }

        const storeBody = await storeRes.json();
        storeName = storeBody?.data?.attributes?.name;
    } catch (err) {
        return NextResponse.json(
            { error: "Failed to reach Lemon Squeezy. Please try again." },
            { status: 502 }
        );
    }

    // Step 2 — Prevent duplicates
    const existing = await prisma.integration.findFirst({
        where: {
            provider: "lemonsqueezy",
            OR: [
                { externalAccountId: normalizedStoreId },
                { workspaceId: workspace.id },
            ],
        },
    });
    if (existing) {
        return NextResponse.json(
            { error: "This workspace or Lemon Squeezy store is already connected" },
            { status: 409 }
        );
    }

    const ingestionServerURL = "https://ingest.convrs.dev";
    // Lemon Squeezy doesn't generate this for you — you choose the secret
    // and it signs requests with it, so we mint one ourselves.
    const generatedSecret = crypto.randomBytes(20).toString("hex");

    // Step 3 — Create the webhook
    let webhookId: string;
    try {
        const webhookRes = await fetch(`${LEMONSQUEEZY_API}/webhooks`, {
            method: "POST",
            headers: lemonSqueezyHeaders(normalizedApiKey),
            body: JSON.stringify({
                data: {
                    type: "webhooks",
                    attributes: {
                        url: `${ingestionServerURL}/api/lemonsqueezy/webhook/${workspace.id}`,
                        events: [...LEMONSQUEEZY_EVENTS],
                        secret: generatedSecret,
                    },
                    relationships: {
                        store: {
                            data: { type: "stores", id: normalizedStoreId },
                        },
                    },
                },
            }),
        });

        if (!webhookRes.ok) {
            const body = await webhookRes.json().catch(() => null);
            const detail = body?.errors?.[0]?.detail;
            if (webhookRes.status === 401 || webhookRes.status === 403) {
                return NextResponse.json(
                    {
                        error:
                            detail ||
                            "This API key can't create webhooks for that store. Make sure it belongs to the same account as the Store ID.",
                    },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: detail || "Failed to register webhook" },
                { status: 500 }
            );
        }

        const webhookBody = await webhookRes.json();
        webhookId = String(webhookBody?.data?.id);
    } catch (err) {
        return NextResponse.json({ error: "Failed to register webhook" }, { status: 500 });
    }

    // Step 4 — Store encrypted
    await prisma.integration.create({
        data: {
            workspaceId: workspace.id,
            provider: "lemonsqueezy",
            externalAccountId: normalizedStoreId,
            apiKeyEncrypted: encrypt(normalizedApiKey),
            webhookId,
            webhookSecret: generatedSecret,
        },
    });

    return NextResponse.json({ success: true, accountId: normalizedStoreId, storeName });
}