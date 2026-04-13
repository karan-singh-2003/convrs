declare module "@repo/utils" {
  export function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    retries?: number
  ): Promise<Response>;

  export function capitalize(value: string): string;

  export function getDomainWithoutWWW(url: string): string | null;

  export function hashStringSHA256(value: string): Promise<string>;
}
