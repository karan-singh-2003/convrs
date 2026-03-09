import { WorkspaceRole } from "@prisma/client";
import { PermissionAction } from "../rbac/permissions";
import { ResourceKey } from "../rbac/resources";

export const SCOPES = [
  "workspace.read",
  "workspace.write",
  "webhooks.write",
  "webhooks.read",
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
    permission: ["tokens.read"],
    resource: "webhooks",
    type: "read",
  },
  {
    scope: ["webhooks.write"],
    permission: ["tokens.write"],
    resource: "webhooks",
    type: "write",
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