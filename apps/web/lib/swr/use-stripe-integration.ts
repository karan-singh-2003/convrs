import { fetcher } from "@repo/utils";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

type StripeIntegration = {
  id: string;
  workspaceId: string;
  stripeAccountId: string;
  webhookId: string;
  createdAt: string;
};

export default function useStripeIntegration() {
  const { id: workspaceId } = useWorkspace();

  const { data, error, isLoading, mutate } = useSWR<{
    integration: StripeIntegration | null;
  }>(
    workspaceId ? `/api/integrations/stripe?workspaceId=${workspaceId}` : null,
    fetcher,
    {
      dedupingInterval: 30000,
    }
  );

  return {
    stripeIntegration: data?.integration ?? null,
    connected: Boolean(data?.integration),
    loading: isLoading,
    error,
    mutate,
  };
}
