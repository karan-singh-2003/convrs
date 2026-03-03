import { fetcher } from "@repo/utils";
import useSWR from "swr";
import { UserProps } from "../types";

export default function useUser() {
  const { data, isLoading, mutate } = useSWR<UserProps>("/api/user", fetcher);

  return {
    user: data,
    loading: isLoading,
    mutate,
  };
}
