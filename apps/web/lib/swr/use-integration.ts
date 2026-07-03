// apps/web/lib/swr/use-integrations.ts
import { fetcher } from "@repo/utils";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

export type RevenueProvider =
  | "stripe"
  | "dodo"
  | "polar"
  | "lemonsqueezy"
  | "paddle";

export type Integration = {
  id: string;
  workspaceId: string;
  provider: RevenueProvider;
  externalAccountId: string | null;
  webhookId: string | null;
  createdAt: string;
};

export default function useIntegrations() {
  const { id: workspaceId } = useWorkspace();

  const { data, error, isLoading, mutate } = useSWR<{
    integrations: Integration[];
  }>(
    workspaceId ? `/api/integrations?workspaceId=${workspaceId}` : null,
    fetcher,
    {
      dedupingInterval: 30000,
    }
  );

  const integrations = data?.integrations ?? [];

  return {
    integrations,
    getIntegration: (provider: RevenueProvider) =>
      integrations.find((i) => i.provider === provider) ?? null,
    isConnected: (provider: RevenueProvider) =>
      integrations.some((i) => i.provider === provider),
    loading: isLoading,
    error,
    mutate,
  };
}