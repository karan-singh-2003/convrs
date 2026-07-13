// apps/web/app/api/integrations/polar/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

// Events chosen to mirror the coverage we get from the other providers:
// a "payment landed" event, subscription lifecycle create/update, a
// cancellation/revocation event, and a refund event.
const POLAR_EVENTS = [
    "order.paid",
    "subscription.created",
    "subscription.updated",
    "subscription.revoked",
    "refund.created",
] as const;

export async function POST(req: NextRequest) {
    const { apiKey, organizationId, workspaceId } = await req.json();
    const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    const normalizedOrganizationId =
        typeof organizationId === "string" ? organizationId.trim() : "";
    const workspaceIdentifier =
        typeof workspaceId === "string" ? workspaceId.trim() : "";
    const normalizedWorkspaceId = normalizeWorkspaceId(workspaceIdentifier)
    console.log("normalized workspace id", normalizedWorkspaceId)

    if (!normalizedApiKey || !normalizedOrganizationId) {
        return NextResponse.json(
            { error: "Missing organization ID or access token" },
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

    // Polar doesn't distinguish sandbox vs. production tokens by prefix — it's
    // purely a matter of which base URL you call (api.polar.sh vs the sandbox
    // API). We can't tell from the token string alone, so try production
    // first and fall back to sandbox before giving up.
    let polar: Polar | undefined;
    let orgVerifyError: { message: string; status: number } | null = null;

    for (const server of ["production", "sandbox"] as const) {
        const client = new Polar({ accessToken: normalizedApiKey, server });
        try {
            const organization = await client.organizations.get({ id: normalizedOrganizationId });
            if (organization?.id) {
                polar = client;
                break;
            }
        } catch (err) {
            if (err instanceof PolarError && [401, 403, 404].includes(err.statusCode)) {
                // Likely just "wrong environment" — remember it and try the other one.
                orgVerifyError = { message: err.message, status: err.statusCode };
                continue;
            }
            return NextResponse.json(
                { error: (err as any)?.message || "Failed to verify Polar credentials" },
                { status: 400 }
            );
        }
    }

    if (!polar) {
        const status = orgVerifyError?.status === 401 ? 401 : 403;
        const error =
            status === 401
                ? "Polar rejected this access token. Double-check it and try again."
                : "This token doesn't have access to that organization ID (checked both production and sandbox).";
        return NextResponse.json({ error }, { status });
    }

    const verifiedPolar = polar;

    // Step 2 — Prevent duplicates
    const existing = await prisma.integration.findFirst({
        where: {
            provider: "polar",
            OR: [
                { externalAccountId: normalizedOrganizationId },
                { workspaceId: workspace.id },
            ],
        },
    });
    if (existing) {
        return NextResponse.json(
            { error: "This workspace or Polar organization is already connected" },
            { status: 409 }
        );
    }

    const ingestionServerURL = "https://ingest.convrs.dev";

    // Step 3 — Create the webhook endpoint in the customer's Polar org.
    // format: "raw" matches the Standard Webhooks payload our ingestion
    // controller verifies with `validateEvent` from @polar-sh/sdk/webhooks.
    //
    // Polar has two token shapes here: a personal access token (can span
    // multiple orgs, so organization_id is required to say which one) and an
    // organization-scoped token (created from within the org's own
    // Settings → Developer page — which is what our instructions point
    // people to). The API rejects organization_id outright for the latter
    // ("disallowed when using an organization token"), so we try with it
    // first and fall back to omitting it if that's the complaint.
    function isOrgTokenDisallowedError(err: unknown): boolean {
        if (!err || typeof err !== "object") return false;
        const e = err as any;

        const candidateDetails: any[] = [];
        if (Array.isArray(e.detail)) candidateDetails.push(...e.detail);
        if (Array.isArray(e.data$?.detail)) candidateDetails.push(...e.data$.detail);
        if (typeof e.body$ === "string") {
            try {
                const parsed = JSON.parse(e.body$);
                if (Array.isArray(parsed?.detail)) candidateDetails.push(...parsed.detail);
            } catch {
                // not JSON, ignore
            }
        } else if (Array.isArray(e.body$?.detail)) {
            candidateDetails.push(...e.body$.detail);
        }

        if (candidateDetails.some((d) => d?.type === "organization_token")) return true;

        const message = typeof e.message === "string" ? e.message : "";
        return message.includes("organization_token") || message.includes("disallowed when using an organization token");
    }

    async function createWebhook(includeOrganizationId: boolean) {
        return verifiedPolar.webhooks.createWebhookEndpoint({
            url: `${ingestionServerURL}/api/polar/webhook/${normalizedWorkspaceId}`,
            format: "raw",
            events: [...POLAR_EVENTS],
            ...(includeOrganizationId ? { organizationId: normalizedOrganizationId } : {}),
        });
    }

    let webhookId: string;
    let webhookSecret: string;
    try {
        let webhook;
        try {
            webhook = await createWebhook(true);
        } catch (err) {
            if (isOrgTokenDisallowedError(err)) {
                webhook = await createWebhook(false);
            } else {
                throw err;
            }
        }
        webhookId = webhook.id;
        webhookSecret = webhook.secret;
    } catch (err) {
        if (err instanceof PolarError) {
            if (err.statusCode === 401 || err.statusCode === 403) {
                return NextResponse.json(
                    {
                        error:
                            "This token can't create webhooks. Re-create it with the webhook:write scope enabled.",
                    },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: err.message || "Failed to register webhook" },
                { status: err.statusCode && err.statusCode < 500 ? err.statusCode : 500 }
            );
        }
        return NextResponse.json({ error: "Failed to register webhook" }, { status: 500 });
    }

    // Step 4 — Store encrypted
    await prisma.integration.create({
        data: {
            workspaceId: workspace.id,
            provider: "polar",
            externalAccountId: normalizedOrganizationId,
            apiKeyEncrypted: encrypt(normalizedApiKey),
            webhookId,
            webhookSecret,
        },
    });

    return NextResponse.json({ success: true, accountId: normalizedOrganizationId });
}