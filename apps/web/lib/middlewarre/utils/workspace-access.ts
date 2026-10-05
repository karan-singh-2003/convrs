import { sql } from "@repo/db/edge";
import { isEntitled } from "@/lib/billing/entitlement";

// First path segments that are app routes, not workspace slugs.
const NON_WORKSPACE_SEGMENTS = new Set([
  "account",
  "auth",
  "dashboard",
  "docs",
  "forgot-password",
  "invites",
  "login",
  "new",
  "onboarding",
  "register",
  "shared",
  "two-factor-challenge",
]);

// Routes under /{slug} that stay reachable without trial/paid access: the
// billing/upgrade flow itself, and accepting an invite to the workspace.
const ALWAYS_ALLOWED_SUBPATHS = new Set(["billing", "invite"]);

/**
 * The workspace slug whose access this path requires, or null when the path
 * isn't a gated workspace route (a non-workspace route, billing, or invite).
 */
export function getGatedWorkspaceSlug(path: string): string | null {
  const [slug, subpath] = path.split("/").filter(Boolean);
  if (!slug || NON_WORKSPACE_SEGMENTS.has(slug)) return null;
  if (subpath && ALWAYS_ALLOWED_SUBPATHS.has(subpath)) return null;
  return slug;
}

/**
 * True when the workspace exists and has neither an unexpired trial nor a paid
 * subscription — decided by the same `isEntitled` policy the [slug] layout
 * and `withWorkspace` use. Unknown slugs return false so the route can 404.
 */
export async function isWorkspaceAccessBlocked(slug: string): Promise<boolean> {
  const rows = await sql`
    SELECT "subscriptionStatus", "freeTrialEndDate", "paymentFailedAt"
    FROM "Workspace"
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const workspace = rows[0] as
    | {
        subscriptionStatus: string | null;
        freeTrialEndDate: Date | string | null;
        paymentFailedAt: Date | string | null;
      }
    | undefined;

  if (!workspace) return false;
  return !isEntitled(workspace);
}
