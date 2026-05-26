"use client";

import { FunnelProps } from "@/lib/types";
import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";

export default function useFunnels({
  workspaceId,
  swrOpts,
}: { workspaceId?: string; swrOpts?: SWRConfiguration } = {}) {
  const { slug } = useParams() as { slug?: string };
  const workspaceKey = workspaceId ?? slug;

  const {
    data: response,
    error,
    mutate,
  } = useSWR<{ data: FunnelProps[] }>(
    workspaceKey ? `/api/workspaces/${workspaceKey}/funnels` : null,
    fetcher,
    {
      dedupingInterval: 30000,
      ...swrOpts,
    }
  );

  return {
    funnels: response?.data ?? [],
    error,
    mutate,
    loading: Boolean(workspaceKey && !response && !error),
  };
}
