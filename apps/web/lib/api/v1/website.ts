import { WorkspaceProps } from "../../types";
import { prefixWorkspaceId, normalizeWorkspaceId } from "../workspaces/workspace-id";
import { isEntitled } from "../../billing/entitlement";
import { apiError } from "./response";

/**
 * The public "website" resource. Convrs has no separate Website model — a
 * Workspace *is* a website (1:1, see the billing-rework memory / domain.prisma
 * CLAUDE.md notes) — so this only reshapes real Workspace fields, it doesn't
 * invent new ones.
 */
export function toPublicWebsite(workspace: WorkspaceProps) {
  return {
    id: prefixWorkspaceId(workspace.id),
    name: workspace.name,
    domain: workspace.domain,
    timezone: workspace.timezone,
    currency: workspace.currency,
    createdAt: workspace.createdAt,
    plan: workspace.plan,
    planFamily: workspace.planFamily,
    cookielessMode: workspace.cookielessMode,
    status: isEntitled(workspace) ? "active" : "inactive",
  };
}

export type PublicWebsite = ReturnType<typeof toPublicWebsite>;

/**
 * A token is bound to exactly one workspace (RestrictedToken.workspaceId).
 * Every /api/v1/analytics/* route accepts an optional `websiteId` so the
 * request shape matches multi-website API conventions, but it can never
 * widen access beyond the token's own workspace — this is the IDOR
 * boundary. Returns null when the request is in-scope, or a 403 Response
 * when the caller asked for a website the token isn't bound to.
 */
export function checkWebsiteScope(
  workspace: WorkspaceProps,
  requestedWebsiteId: string | undefined
): Response | null {
  if (!requestedWebsiteId) return null;

  const normalized = normalizeWorkspaceId(requestedWebsiteId);
  if (normalized !== workspace.id) {
    return apiError(
      "forbidden",
      "This token is not authorized for the requested website."
    );
  }

  return null;
}
