import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { getSearchParams } from "@repo/utils";
import { hashToken } from "./hash-token";
import { Scope, tokenHasScope } from "../api/tokens/scopes";
import { apiError } from "../api/v1/response";
import { checkApiRateLimit } from "../api/v1/rate-limit";
import { WorkspaceProps } from "../types";

// Tokens minted from now on use cvrs_; bc_ is the legacy prefix from before
// the public API existed and is still accepted so existing tokens keep
// working (see apps/web/app/api/tokens/route.ts).
const VALID_TOKEN_PREFIXES = ["cvrs_", "bc_"];

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;

  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export interface ApiTokenAuth {
  id: string;
  name: string;
  scopes: string[];
}

interface WithApiTokenHandlerArgs {
  req: NextRequest;
  params: Record<string, string>;
  searchParams: Record<string, string>;
  workspace: WorkspaceProps;
  token: ApiTokenAuth;
}

type WithApiTokenHandler = (
  args: WithApiTokenHandlerArgs
) => Promise<Response>;

/**
 * Auth for /api/v1/* only — parallel to lib/auth/workspace.ts's
 * `withWorkspace`, which is session-cookie auth for the dashboard's own
 * routes and doesn't apply here (a Bearer-token request has no session).
 *
 * The token's own `workspaceId` is the ONLY source of workspace scoping:
 * callers never get to pick a workspace by ID/slug the way session-based
 * routes do. Route handlers that accept a `websiteId` query/path param must
 * check it against `workspace.id` themselves (see lib/api/v1/website.ts) —
 * this function only proves "this token belongs to workspace X".
 */
export function withApiToken(
  handler: WithApiTokenHandler,
  { requiredScope }: { requiredScope?: Scope } = {}
) {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const params = (await context.params) || {};
    const searchParams = getSearchParams(req.url) as Record<string, string>;

    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      return apiError(
        "unauthorized",
        "Missing or malformed Authorization header. Use: Authorization: Bearer <token>"
      );
    }

    if (!VALID_TOKEN_PREFIXES.some((prefix) => rawToken.startsWith(prefix))) {
      return apiError("unauthorized", "Invalid API token.");
    }

    const hashedKey = await hashToken(rawToken);

    const record = await prisma.restrictedToken.findUnique({
      where: { hashedKey },
      select: {
        id: true,
        name: true,
        scopes: true,
        expires: true,
        workspaceId: true,
      },
    });

    // Same message whether the token doesn't exist, was revoked/deleted, or
    // never existed — don't let the response distinguish those cases.
    if (!record) {
      return apiError("unauthorized", "Invalid API token.");
    }

    if (record.expires && record.expires < new Date()) {
      return apiError("unauthorized", "This API token has expired.");
    }

    const scopes = (record.scopes ?? "").split(" ").filter(Boolean);
    if (requiredScope && !tokenHasScope(scopes, requiredScope)) {
      return apiError(
        "forbidden",
        `This token does not have the required scope: ${requiredScope}`
      );
    }

    const rateLimit = await checkApiRateLimit(record.id);
    if (!rateLimit.allowed) {
      return apiError(
        "rate_limit_exceeded",
        "Too many requests. Please slow down and retry later.",
        {
          "Retry-After": String(rateLimit.retryAfter),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": "0",
        }
      );
    }

    const workspace = (await prisma.workspace.findUnique({
      where: { id: record.workspaceId },
    })) as WorkspaceProps | null;

    // The workspace behind an existing token was deleted — treat the token
    // as unusable rather than leaking that distinction.
    if (!workspace) {
      return apiError("unauthorized", "Invalid API token.");
    }

    // Best-effort, non-blocking — a failed lastUsed write must never fail
    // the request.
    prisma.restrictedToken
      .update({ where: { id: record.id }, data: { lastUsed: new Date() } })
      .catch(() => {});

    return handler({
      req,
      params,
      searchParams,
      workspace,
      token: { id: record.id, name: record.name, scopes },
    });
  };
}
