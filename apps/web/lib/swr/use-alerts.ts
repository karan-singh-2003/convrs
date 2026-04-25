"use client";

import { AlertProps } from "@/lib/types";
import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";

export default function useAlerts({
  swrOpts,
}: { swrOpts?: SWRConfiguration } = {}) {
  const { slug } = useParams() as { slug?: string };

  const {
    data: response,
    error,
    mutate,
  } = useSWR<{ data: AlertProps[] }>(
    slug ? `/api/workspaces/${slug}/alerts` : null,
    fetcher,
    {
      dedupingInterval: 30000,
      ...swrOpts,
    }
  );

  return {
    alerts: response?.data ?? [],
    error,
    mutate,
    loading: Boolean(slug && !response && !error),
  };
}
