import { WorkspaceUserProps } from "@/lib/types";
import { fetcher } from "@repo/utils";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

export default function useWorkspaceUsers({
  invites,
}: { invites?: boolean } = {}) {
  const { id } = useWorkspace();

  const { data: users, error } = useSWR<WorkspaceUserProps[]>(
    id &&
      (invites
        ? `/api/workspaces/${id}/invites`
        : `/api/workspaces/${id}/users`),
    fetcher,
  );

  return {
    users,
    loading: !error && !users,
  };
}