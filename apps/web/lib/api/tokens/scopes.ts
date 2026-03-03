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
  roles: WorkspaceRole[];
  permission: PermissionAction[];
  resource?: ResourceKey;
  type?: "read" | "write";
}[] = [
  {
    scope: ["workspace.read"],
    roles: ["owner", "member", "viewer"],
    permission: ["workspace:read"],
    resource: "workspaces",
    type: "read",
  },
  {
    scope: ["workspace.write"],
    roles: ["owner"],
    permission: ["workspace:write"],
    resource: "workspaces",
    type: "write",
  },
  {
    scope: ["webhooks.read"],
    roles: ["owner", "member", "viewer"],
    permission: ["tokens.read"],
    resource: "webhooks",
    type: "read",
  },
  {
    scope: ["webhooks.write"],
    roles: ["owner"],
    permission: ["tokens.write"],
    resource: "webhooks",
    type: "write",
  },
  {
    scope: ["apis.all"],
    roles: ["owner", "member"],
    permission: ["workspace:read", "workspace:write"],
  },
  {
    scope: ["apis.read"],
    roles: ["owner", "member", "viewer"],
    permission: ["workspace:read"],
  },
];

export const roles_scopes_map = RESOURCE_SCOPES.reduce((acc, scope) => {
  scope.roles.forEach((role) => {
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(...scope.scope);
  });
  return acc;
}, {});

// Utiliity function to get scopes based on role - used in route.ts when creating token with preset scopes
export const validateScopesForRole = (role: WorkspaceRole, scopes: Scope[]) => {
  const validScopes = roles_scopes_map[role];
  console.log("validScopes for role", role, "are", validScopes);
  const invalidScopes = scopes.filter((scope) => !validScopes.includes(scope));
  return !(invalidScopes.length > 0);
};

export const getScopesByResourceForRole = (role: WorkspaceRole) => {
  const groupedByResource = [];

  const allowedScopes = RESOURCE_SCOPES.filter((scope) =>
    scope.roles.includes(role)
  );

  allowedScopes.forEach((scope) => {
    const resource = scope.resource;
    if (resource) {
      if (!groupedByResource[resource]) {
        groupedByResource[resource] = [];
      }
      groupedByResource[resource].push(scope);
    }
  });
  return groupedByResource;
};

// used in frontend for preset options
export const scopePresets = [
  {
    value: "all_access",
    label: "All",
    description: "full access to all resources",
  },
  {
    value: "read_only",
    label: "Read Only",
    description: "read-only access to all resources",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "restricted access to some resources",
  },
];

// Utility function to convert scopes to a user-friendly name and description - used in route.ts
export const scopesToName = (scopes: Scope[]) => {
  if (scopes.includes("apis.all")) {
    return {
      name: "All access",
      description: "full access to all resources",
    };
  }

  if (scopes.includes("apis.read")) {
    return {
      name: "Read-only",
      description: "read-only access to all resources",
    };
  }

  return {
    name: "Restricted",
    description: "restricted access to some resources",
  };
};
