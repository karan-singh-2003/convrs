import { WorkspaceRole } from "@repo/db/client";

export const PERMISSION_ACTIONS = [
  "workspace:read",
  "workspace:write",
  "billing:read",
  "billing:write",
  "tokens.read",
  "tokens.write",
  "webhooks.read",
  "webhooks.write",
  "analytics.read",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ROLE_PERMISSIONS: {
  action: PermissionAction;
  roles: WorkspaceRole[];
  description: string;
}[] = [
  {
    action: "workspace:read",
    roles: ["owner", "member", "viewer"],
    description: "Allows reading workspace data",
  },
  {
    action: "workspace:write",
    roles: ["owner"],
    description: "Allows modifying workspace data",
  },
  {
    action: "billing:read",
    roles: ["owner", "member", "billing"],
    description: "Allows reading billing and subscription data",
  },
  {
    action: "billing:write",
    roles: ["owner"],
    description: "Allows managing billing and subscriptions",
  },
  {
    action: "tokens.read",
    roles: ["owner", "member"],
    description: "Allows reading tokens",
  },
  {
    action: "tokens.write",
    roles: ["owner"],
    description: "Allows creating and managing tokens",
  },
  {
    action: "webhooks.read",
    roles: ["owner", "member"],
    description: "Allows reading webhooks",
  },
  {
    action: "webhooks.write",
    roles: ["owner"],
    description: "Allows creating and managing webhooks",
  },
  {
    action: "analytics.read",
    roles: ["owner", "member", "viewer"],
    description: "Allows reading analytics data",
  }

];

export const getPermissionsForRole = (role: WorkspaceRole) => {
  return ROLE_PERMISSIONS.filter(({ roles }) => roles.includes(role)).map(
    ({ action }) => action
  );
};
