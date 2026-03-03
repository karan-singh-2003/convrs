import { fetcher } from "@repo/utils";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { WorkspaceProps } from "../types";

export default function UseWorkspaces() {
  const { data: session } = useSession();
  const { data: workspaces, error } = useSWR<WorkspaceProps[]>(
    session?.user && `/api/workspaces`,
    fetcher,
    {
      dedupingInterval: 60000,
    }
  );

  return {
    workspaces,
    error,
    loading: !workspaces && !error ? true : false,
  };
}
