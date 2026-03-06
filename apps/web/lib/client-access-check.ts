import { WorkspaceRole } from "@repo/db/client";
import { PermissionAction, ROLE_PERMISSIONS } from "./api/rbac/permissions";

export const clientAccessCheck = ({
  action,
  role,
  customPermissionDescription,
}: {
  action: PermissionAction;
  role: WorkspaceRole;
  customPermissionDescription?: string;
}) => {
  const permission = ROLE_PERMISSIONS.find((p) => p.action === action)!;
  const allowedWorkspaceRoles = permission.roles;
  const allowed = allowedWorkspaceRoles.includes(role);

  if (allowed) {
    return {
      allowed,
      error: false,
    };
  }

  return {
    allowed,
    error: `Only workspace ${combineWords(allowedWorkspaceRoles.map((r) => `${r === "billing" ? "billing user" : r}s`))} can ${customPermissionDescription || permission.description}.`,
  };
};

export const combineWords = (words: string[]) => {
  return (
    words
      .join(", ")
      // final one should be "and" instead of comma
      .replace(/, ([^,]*)$/, " and $1")
  );
};