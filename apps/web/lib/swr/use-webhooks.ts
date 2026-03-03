import useSWR from "swr";
import useWorkspace from "./use-workspace";
import { fetcher } from "@repo/utils";
import { WebhookProps } from "../types";

export default function useWebhooks() {
  const { id: workspaceId } = useWorkspace();

  const {
    data: webhooks,
    isLoading,
    isValidating,
  } = useSWR<WebhookProps[]>(`/api/webhooks?workspaceId=${workspaceId}`, fetcher, {
    dedupingInterval: 60000,
  });

  return {
    webhooks,
    isLoading,
    isValidating,
  }
}
