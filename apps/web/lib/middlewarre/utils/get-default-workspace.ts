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
      u.default_workspace,
      w.slug AS workspace_slug
    FROM users u
    LEFT JOIN workspace_users wu
      ON wu.user_id = u.id
    LEFT JOIN workspaces w
      ON w.id = wu.workspace_id
    WHERE u.id = ${user.id}
    ORDER BY wu.created_at ASC
    LIMIT 1
  `;

  const row = rows[0] as DefaultWorkspaceRow | undefined;

  return (
    row?.default_workspace ||
    row?.workspace_slug ||
    undefined
  );
}
