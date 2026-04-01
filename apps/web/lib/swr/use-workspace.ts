'use client'
import { useParams, useSearchParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";
import { fetcher } from "@repo/utils";
import { WorkspaceProps } from "../types";

export default function useWorkspace({
  swrOpts,
}: { swrOpts?: SWRConfiguration } = {}) {
  let { slug } = useParams() as { slug: string | null };
  const searchParams = useSearchParams();
  if (!slug) {
    slug = searchParams.get("slug") || searchParams.get("workspace");
  }
  const {
    data: workspace,
    error,
    mutate,
  } = useSWR<WorkspaceProps>(slug && `/api/workspaces/${slug}`, fetcher, {
    dedupingInterval: 60000,
    ...swrOpts,
  });


  return {
    ...workspace,
    subscription:workspace?.subscriptionStatus,
    role: (workspace?.users && workspace.users[0]?.role) || "member",
    isOwner: workspace?.users && workspace.users[0]?.role === "owner",
    error,
    mutate,
    loading: slug && !workspace && !error ? true : false,
  };
}
