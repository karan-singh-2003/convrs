"use client";

import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useSession } from "next-auth/react";

/** Shape returned by GET /api/billing/context (see lib/billing/subscription-service.ts#getBillingContext). */
export interface BillingContextSubscription {
  id: string;
  planFamily: "standard" | "growth";
  planTier: string;
  interval: "monthly" | "yearly" | null;
  status: string;
  workspaceCount: number;
  maxWorkspaces: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingContext {
  dodoCustomerId: string | null;
  trialAvailable: boolean;
  subscriptions: BillingContextSubscription[];
  growthSubWithFreeSeat: {
    id: string;
    workspaceCount: number;
    maxWorkspaces: number;
  } | null;
  standardSubs: { id: string; planTier: string; workspaceId: string | null }[];
}

/**
 * Everything the billing / "add website" UI needs about the current user's
 * subscriptions in one call. User-scoped (not workspace-scoped).
 */
export default function useBillingContext() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR<BillingContext>(
    session?.user ? "/api/billing/context" : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return { billingContext: data, error, loading: isLoading, mutate };
}
