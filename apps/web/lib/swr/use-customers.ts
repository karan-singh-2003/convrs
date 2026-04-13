"use client";

import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";

export type CustomerItem = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  externalId: string | null;
  stripeCustomerId: string | null;
  country: string | null;
  sales: number;
  saleAmount: number;
  firstSaleAt: string | null;
  subscriptionCanceledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export default function useCustomers({
  limit = 200,
  swrOpts,
}: {
  limit?: number;
  swrOpts?: SWRConfiguration;
} = {}) {
  const { slug } = useParams() as { slug?: string };

  const {
    data: response,
    error,
    mutate,
  } = useSWR<{ customers: CustomerItem[] }>(
    slug ? `/api/workspaces/${slug}/customers?limit=${limit}` : null,
    fetcher,
    {
      dedupingInterval: 15000,
      ...swrOpts,
    }
  );

  return {
    customers: response?.customers ?? [],
    error,
    mutate,
    loading: Boolean(slug && !response && !error),
  };
}
