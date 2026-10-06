import { hashToken, withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { nanoid } from "@repo/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Bot Traffic settings: the website's optional server-side token for
 * POST ingest.convrs.dev/api/ai-crawls, and whether requests without a valid
 * token are rejected. By default the public project token alone is enough;
 * the bot token is opt-in hardening.
 *
 * The token is a RestrictedToken row with the `cvbot_` prefix. The public API
 * only accepts `cvrs_`/`bc_` tokens, so a bot token can never read data, and
 * it is hidden from the API-tokens list. One active bot token per website:
 * rotating deletes the previous one (ingestion's 10s verdict cache bounds how
 * long it keeps working).
 */
const BOT_TOKEN_PREFIX = "cvbot_";
const BOT_TOKEN_NAME = "Bot traffic token";

const botTokenWhere = (workspaceId: string) => ({
  workspaceId,
  partialKey: { startsWith: BOT_TOKEN_PREFIX },
});

async function readState(workspaceId: string) {
  const [workspace, token] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { botTrafficRequireAuth: true },
    }),
    prisma.restrictedToken.findFirst({
      where: botTokenWhere(workspaceId),
      select: { partialKey: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    requireAuth: workspace?.botTrafficRequireAuth ?? false,
    token: token ? { partialKey: token.partialKey, createdAt: token.createdAt } : null,
  };
}

// GET — current settings (never returns the raw token)
export const GET = withWorkspace(
  async ({ workspace }) => NextResponse.json(await readState(workspace.id)),
  { requiredPermission: "workspace:read" }
);

// POST — create or rotate the bot token; the raw value is returned once
export const POST = withWorkspace(
  async ({ workspace, session }) => {
    const token = `${BOT_TOKEN_PREFIX}${nanoid(32)}`;
    const hashedKey = await hashToken(token);
    const partialKey = `${token.slice(0, 12)}...${token.slice(-4)}`;

    await prisma.$transaction([
      prisma.restrictedToken.deleteMany({ where: botTokenWhere(workspace.id) }),
      prisma.restrictedToken.create({
        data: {
          name: BOT_TOKEN_NAME,
          hashedKey,
          partialKey,
          scopes: null,
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({ ...(await readState(workspace.id)), rawToken: token });
  },
  { requiredPermission: "tokens.write" }
);

// DELETE — revoke the bot token (does not change requireAuth)
export const DELETE = withWorkspace(
  async ({ workspace }) => {
    await prisma.restrictedToken.deleteMany({ where: botTokenWhere(workspace.id) });
    return NextResponse.json(await readState(workspace.id));
  },
  { requiredPermission: "tokens.write" }
);

const patchSchema = z.object({ requireAuth: z.boolean() });

// PATCH — reject unauthenticated bot-traffic requests on/off
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "requireAuth must be a boolean" }, { status: 400 });
    }
    // Requiring auth with no token to send would silently reject every
    // Bot Traffic event, so a usable bot or API token must exist first.
    if (parsed.data.requireAuth) {
      const usableTokens = await prisma.restrictedToken.count({
        where: {
          workspaceId: workspace.id,
          OR: [{ expires: null }, { expires: { gt: new Date() } }],
        },
      });
      if (usableTokens === 0) {
        return NextResponse.json(
          { error: "Generate a bot traffic token before rejecting unauthenticated requests." },
          { status: 400 }
        );
      }
    }
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { botTrafficRequireAuth: parsed.data.requireAuth },
    });
    return NextResponse.json(await readState(workspace.id));
  },
  { requiredPermission: "workspace:write" }
);
