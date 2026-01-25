import { UserProps } from "@/lib/types";
import { edgeDb } from "@repo/db/edge-raw";

export async function getDefaultWorkspace(user: UserProps) {
  let defaultWorkspace = user?.defaultWorkspace;

  if (!defaultWorkspace) {
    const refreshedUser = await edgeDb.findUserWithWorkspaces(user.id);

    defaultWorkspace =
      refreshedUser?.defaultWorkspace ||
      refreshedUser?.workspaceUsers?.[0]?.workspace?.slug ||
      undefined;
  }

  return defaultWorkspace;
}
