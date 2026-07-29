const X_API_BASE = "https://api.twitter.com/2";

type XUser = {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: { followers_count?: number };
};

type XTweet = {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    impression_count?: number;
  };
};

type XSearchResponse = {
  data?: XTweet[];
  includes?: { users?: XUser[] };
  meta?: { next_token?: string };
};

function getBearerToken(): string {
  const token = process.env.X_API_BEARER_TOKEN;
  if (!token) throw new Error("X_API_BEARER_TOKEN is not set");
  return token;
}

async function xFetch(path: string): Promise<XSearchResponse> {
  const response = await fetch(`${X_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getBearerToken()}` },
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new XRateLimitError(retryAfter ? Number(retryAfter) : 60);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`X API error ${response.status}: ${body}`);
  }

  return response.json();
}

export class XRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("X API rate limited");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const SEARCH_FIELDS =
  "tweet.fields=public_metrics,created_at,author_id" +
  "&expansions=author_id" +
  "&user.fields=username,name,profile_image_url,verified,public_metrics";

/** Recent search — X's `url:` operator matches the EXPANDED destination
 * URL even though the tweet displays a t.co link, which is what makes
 * domain-based discovery tractable without ever expanding links ourselves. */
export async function searchRecentTweets(params: {
  query: string;
  nextToken?: string;
  maxResults?: number;
}): Promise<{ tweets: XTweet[]; users: XUser[]; nextToken: string | null }> {
  const searchParams = new URLSearchParams({
    query: params.query,
    max_results: String(params.maxResults ?? 25),
  });
  if (params.nextToken) searchParams.set("next_token", params.nextToken);

  const result = await xFetch(`/tweets/search/recent?${searchParams}&${SEARCH_FIELDS}`);

  return {
    tweets: result.data ?? [],
    users: result.includes?.users ?? [],
    nextToken: result.meta?.next_token ?? null,
  };
}

/** Batched metadata refresh — up to 100 tweet IDs per call. */
export async function getTweetsByIds(
  ids: string[]
): Promise<{ tweets: XTweet[]; users: XUser[] }> {
  if (ids.length === 0) return { tweets: [], users: [] };
  const searchParams = new URLSearchParams({ ids: ids.slice(0, 100).join(",") });
  const result = await xFetch(`/tweets?${searchParams}&${SEARCH_FIELDS}`);
  return { tweets: result.data ?? [], users: result.includes?.users ?? [] };
}

export function buildDomainSearchQuery(domains: string[]): string {
  // e.g.  (url:"customer.com" OR url:"cnv.rs") -is:retweet
  const urlClauses = domains.map((d) => `url:"${d}"`).join(" OR ");
  return `(${urlClauses}) -is:retweet`;
}

export function buildKeywordSearchQuery(keywords: string[]): string {
  const clauses = keywords.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
  return `(${clauses}) -is:retweet`;
}

export type { XTweet, XUser };