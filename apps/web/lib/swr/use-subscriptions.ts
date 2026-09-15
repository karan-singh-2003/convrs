"use client";

import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useSession } from "next-auth/react";

/** Mirrors SubscriptionSummary from lib/billing/subscription-service.ts. */
export interface SubscriptionSummary {
  id: string;
  planFamily: "standard" | "growth";
  planTier: string;
  interval: "monthly" | "yearly" | null;
  status: string;
  workspaceCount: number;
  maxWorkspaces: number;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanChange: {
    kind: string;
    effectiveAt: string;
    targetFamily: "standard" | "growth";
    targetTier: string;
    targetInterval: "monthly" | "yearly";
    keepWorkspaceId?: string;
  } | null;
  workspaces: { id: string; slug: string; name: string }[];
}

/** GET /api/subscriptions — the caller's subscriptions, newest-attached last. */
export default function useSubscriptions() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR<SubscriptionSummary[]>(
    session?.user ? "/api/subscriptions" : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return { subscriptions: data, error, loading: isLoading, mutate };
}
