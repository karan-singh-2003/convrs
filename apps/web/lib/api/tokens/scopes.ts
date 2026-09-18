import { WorkspaceRole } from "@prisma/client";
import { PermissionAction } from "../rbac/permissions";
import { ResourceKey } from "../rbac/resources";

// Public API (/api/v1/*) scopes. Still reserved for future endpoints — do
// not add these until the corresponding /api/v1 routes exist: "goals.write",
// "websites.write".
//
// Note: "workspace.read"/"workspace.write" and "webhooks.read"/
// "webhooks.write" are not currently required by any /api/v1 route (webhook
// management is session-authenticated only, via lib/auth/workspace.ts's
// withWorkspace, not withApiToken). A token granted only one of these four
// scopes can currently call /api/v1/account and the public /openapi.json
// and nothing else — see the permission-model audit for the full analysis.
export const SCOPES = [
  "workspace.read",
  "workspace.write",
  "webhooks.write",
  "webhooks.read",
  "websites.read",
  "analytics.read",
  "goals.read",
  "payments.read",
  "apis.all", // All API scopes
  "apis.read", // All read scopes
] as const;

export type Scope = (typeof SCOPES)[number];

export const RESOURCE_SCOPES: {
  scope: Scope[];
  permission: PermissionAction[];
  resource?: ResourceKey;
  type?: "read" | "write";
}[] = [
  {
    scope: ["workspace.read"],
    permission: ["workspace:read"],
    resource: "workspace",
    type: "read",
  },
  {
    scope: ["workspace.write"],
    permission: ["workspace:write"],
    resource: "workspace",
    type: "write",
  },
  {
    scope: ["webhooks.read"],
    permission: ["webhooks.read"],
    resource: "webhooks",
    type: "read",
  },
  {
    scope: ["webhooks.write"],
    permission: ["webhooks.write"],
    resource: "webhooks",
    type: "write",
  },
  {
    scope: ["websites.read"],
    permission: ["workspace:read"],
    resource: "websites",
    type: "read",
  },
  {
    scope: ["analytics.read"],
    permission: ["analytics.read"],
    resource: "analytics",
    type: "read",
  },
  {
    scope: ["goals.read"],
    permission: ["analytics.read"],
    resource: "goals",
    type: "read",
  },
  {
    scope: ["payments.read"],
    permission: ["analytics.read"],
    resource: "payments",
    type: "read",
  },
  {
    scope: ["apis.all"],
    permission: ["workspace:read", "workspace:write"],
  },
  {
    scope: ["apis.read"],
    permission: ["workspace:read"],
  },
];

/**
 * Does a token's granted scopes satisfy a required public-API (/api/v1/*)
 * scope? `apis.all` covers everything, `apis.read` covers any `*.read`
 * scope — mirrors the existing preset semantics in SCOPE_PRESETS below.
 */
export function tokenHasScope(
  grantedScopes: string[],
  required: Scope
): boolean {
  if (grantedScopes.includes("apis.all")) return true;
  if (grantedScopes.includes(required)) return true;
  if (required.endsWith(".read") && grantedScopes.includes("apis.read")) {
    return true;
  }
  return false;
}

export const SCOPE_PRESETS: {
  name: string;
  scopes: Scope[];
}[] = [
  {
    name: "All Access",
    scopes: ["apis.all"],
  },
  {
    name: "Read Only",
    scopes: ["apis.read"],
  },
  {
    name: "Custom",
    scopes: [],
  },
];

export const scopesToName = (scopes: Scope[]): { name: string; description: string } => {
  if (scopes.includes("apis.all")) {
    return { name: "All Access", description: "Full access to all API features" };
  }
  if (scopes.includes("apis.read")) {
    return { name: "Read Only", description: "Read-only access to API features" };
  }
  return { name: "Custom", description: scopes.join(", ") || "No scopes assigned" };
}