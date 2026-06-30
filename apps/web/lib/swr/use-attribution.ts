// lib/swr/use-attribution-status.ts
import useSWR from "swr";
import { fetcher } from "@repo/utils";

export function useAttributionStatus(workspaceId: string | undefined) {
  const { data } = useSWR<{ hasAttributedPayment: boolean }>(
    workspaceId ? `/api/workspaces/${workspaceId}/attribution-status` : null,
    fetcher
  );
  return { hasAttributedPayment: data?.hasAttributedPayment ?? false };
}