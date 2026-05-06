// apps/web/lib/swr/use-customer-activity.ts
import useSWR from "swr";

export type ActivityEvent = {
  timestamp: string;
  event_type: string;
  event_name: string;
  page: string | null;
  url: string | null;
  referer: string | null;
  browser: string;
  device: string;
  country: string;
  utm_source: string | null;
  utm_campaign: string | null;
  revenue: number | null;
  currency: string | null;
};

export type ActivityGroup = {
  date: string;
  items: ActivityEvent[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function useCustomerActivity(
  customerId: string | null,
  workspaceId: string | null
) {
  const { data, error, isLoading } = useSWR<{ activity: ActivityGroup[] }>(
    customerId && workspaceId
      ? `/api/workspaces/${workspaceId}/customers/${customerId}/activity`
      : null,
    fetcher
  );

  return {
    activity: data?.activity ?? [],
    isLoading,
    error,
  };
}