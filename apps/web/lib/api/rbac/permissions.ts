import { WorkspaceRole } from "@prisma/client";

export const PERMISSION_ACTIONS = [
  "workspace:read",
  "workspace:write",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ROLE_PERMISSIONS: {
  action: PermissionAction;
  roles: WorkspaceRole[];
  description: string;
}[] = [
  {
    action: "workspace:read",
    roles: ["owner", "member", "viewer", "billing"],
    description: "Allows reading workspace data",
  },
  {
    action: "workspace:write",
    roles: ["owner"],
    description: "Allows modifying workspace data",
  },
];

export const getPermissionsForRole = (role: WorkspaceRole) => {
  return ROLE_PERMISSIONS.filter(({ roles }) => roles.includes(role)).map(
    ({ action }) => action
  );
};
