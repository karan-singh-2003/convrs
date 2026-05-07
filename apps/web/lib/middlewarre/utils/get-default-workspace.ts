import { UserProps } from "@/lib/types";
import { sql } from "@repo/db/edge";

type DefaultWorkspaceRow = {
  default_workspace: string | null;
  workspace_slug: string | null;
};

export async function getDefaultWorkspace(user: UserProps) {
  if (user.defaultWorkspace) {
    return user.defaultWorkspace;
  }

  const rows = await sql`
  SELECT
    u."defaultWorkspaceId",
    w.slug AS workspace_slug
  FROM "User" u
  LEFT JOIN "WorkspaceUsers" wu
    ON wu."userId" = u.id
  LEFT JOIN "Workspace" w
    ON w.id = wu."workspaceId"
  WHERE u.id = ${user.id}
  ORDER BY wu."createdAt" ASC
  LIMIT 1
`;

  const row = rows[0] as DefaultWorkspaceRow | undefined;

  return row?.default_workspace || row?.workspace_slug || undefined;
}
