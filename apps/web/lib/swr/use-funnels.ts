"use client";

import { FunnelProps } from "@/lib/types";
import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";

export default function useFunnels({
  swrOpts,
}: { swrOpts?: SWRConfiguration } = {}) {
  const { slug } = useParams() as { slug?: string };

  const {
    data: response,
    error,
    mutate,
  } = useSWR<{ data: FunnelProps[] }>(
    slug ? `/api/workspaces/${slug}/funnels` : null,
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
    loading: Boolean(slug && !response && !error),
  };
}
