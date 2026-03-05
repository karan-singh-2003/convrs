import useSWR from "swr";
import { fetcher } from "@repo/utils";

export interface SessionItem {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface SessionsResponse {
  sessions: SessionItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function useSessions(page: number = 1, limit: number = 5) {
  const { data, error, mutate, isValidating } = useSWR<SessionsResponse>(
    `/api/account/sessions?page=${page}&limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    sessions: data?.sessions || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 1,
    loading: !data && !error,
    error,
    mutate,
    isValidating,
  };
}
