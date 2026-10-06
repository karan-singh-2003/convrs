import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import {
  detectBotSignals,
  isHostnameAuthorized,
  localhostTrackingAllowed,
  resolveEventHostname,
} from "@repo/analytics";
import { recordHeartbeat } from "@/lib/analytics/live-visitors";
import { isEntitled } from "@/lib/billing/entitlement";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_BODY_BYTES = 4 * 1024;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

const HeartbeatSchema = z.object({
  // The tracker sends its project token (data-website-id) as `workspaceId`.
  workspaceId: z.string().regex(ID),
  visitorId: z.string().regex(ID),
  sessionId: z.string().regex(ID),
  page: z
    .string()
    .max(512)
    .refine((v) => v.startsWith("/"), "page must be a path")
    .default("/"),
  url: z.string().url().max(2048),
});

type HeartbeatWorkspace = {
  domain: string | null;
  allowedHostnames: string[];
  allowAllDomains: boolean;
  subscriptionStatus: string | null;
  freeTrialEndDate: Date | null;
  paymentFailedAt: Date | null;
};

// Heartbeats arrive every 10s per open tab, so the token → workspace lookup
// is cached briefly per instance instead of hitting Postgres on every beat.
const WORKSPACE_CACHE_TTL_MS = 60_000;
const workspaceCache = new Map<string, { expires: number; workspace: HeartbeatWorkspace | null }>();

async function getWorkspaceForToken(projectToken: string): Promise<HeartbeatWorkspace | null> {
  const cached = workspaceCache.get(projectToken);
  if (cached && cached.expires > Date.now()) return cached.workspace;

  const workspace = await prisma.workspace.findUnique({
    where: { projectToken },
    select: {
      domain: true,
      allowedHostnames: true,
      allowAllDomains: true,
      subscriptionStatus: true,
      freeTrialEndDate: true,
      paymentFailedAt: true,
    },
  });

  if (workspaceCache.size > 5_000) workspaceCache.clear();
  workspaceCache.set(projectToken, { expires: Date.now() + WORKSPACE_CACHE_TTL_MS, workspace });
  return workspace;
}

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return reply(413, { ok: false, error: "Payload too large" });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  const parsed = HeartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return reply(400, {
      ok: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  // The page URL's host, cross-checked against the browser Origin.
  const host = resolveEventHostname(parsed.data.url, req.headers.get("origin"));
  if (!host.ok) {
    return reply(host.reason === "invalid_url" ? 400 : 403, { ok: false, error: host.reason });
  }

  // Crawlers that execute JS are not live visitors.
  const bot = detectBotSignals({
    userAgent: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
  });
  if (bot.isBot) {
    return reply(202, { ok: true, ignored: "bot" });
  }

  try {
    const workspace = await getWorkspaceForToken(parsed.data.workspaceId);
    if (!workspace) {
      return reply(404, { ok: false, error: "Unknown website" });
    }
    if (!isEntitled(workspace)) {
      return reply(402, { ok: false, error: "Subscription inactive" });
    }
    if (!isHostnameAuthorized(host.hostname, workspace, { allowLocalhost: localhostTrackingAllowed() })) {
      return reply(403, { ok: false, error: "hostname_not_allowed" });
    }

    // Vercel's edge overwrites these; anywhere else they are client-supplied.
    const onVercel = process.env.VERCEL === "1";
    const latitude = onVercel ? Number(req.headers.get("x-vercel-ip-latitude") ?? NaN) : NaN;
    const longitude = onVercel ? Number(req.headers.get("x-vercel-ip-longitude") ?? NaN) : NaN;
    const country = onVercel ? req.headers.get("x-vercel-ip-country") ?? undefined : undefined;

    await recordHeartbeat({
      ...parsed.data,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      country,
      referrer: req.headers.get("referer") ?? undefined,
    });
    return reply(200, { ok: true });
  } catch (error) {
    console.error("[api/live/heartbeat] Error:", error);
    // Keep tracker resilient: do not surface 500s to heartbeat callers.
    return reply(200, { ok: false });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
