"use client";

import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";
import type { CustomerItem } from "./use-customers";

export default function useCustomer(
  customerId: string | null,
  { swrOpts }: { swrOpts?: SWRConfiguration } = {}
) {
  const { slug } = useParams() as { slug?: string };

  const {
    data: response,
    error,
    mutate,
  } = useSWR<{ customer: CustomerItem }>(
    slug && customerId
      ? `/api/workspaces/${slug}/customers/${encodeURIComponent(customerId)}`
      : null,
    fetcher,
    {
      dedupingInterval: 15000,
      ...swrOpts,
    }
  );

  return {
    customer: response?.customer ?? null,
    error,
    mutate,
    loading: Boolean(slug && customerId && !response && !error),
  };
}
