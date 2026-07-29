import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type RedditPost = {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
};

async function getAccessToken(): Promise<string> {
  const cached = await redis.get<string>("reddit-access-token");
  if (cached) return cached;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set");
  }

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "convrs-social-worker/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Reddit auth error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  // Reddit app-only tokens typically last ~1 hour — cache for slightly less.
  await redis.set("reddit-access-token", data.access_token, { ex: 3300 });
  return data.access_token;
}

export async function searchReddit(query: string, limit = 25): Promise<RedditPost[]> {
  const token = await getAccessToken();
  const searchParams = new URLSearchParams({
    q: query,
    sort: "new",
    limit: String(limit),
  });

  const response = await fetch(`https://oauth.reddit.com/search?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "convrs-social-worker/1.0",
    },
  });

  if (response.status === 429) {
    throw new Error("Reddit rate limited");
  }
  if (!response.ok) {
    throw new Error(`Reddit search error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return (data.data?.children ?? []).map((child: { data: RedditPost }) => child.data);
}

export function buildRedditQuery(terms: string[]): string {
  return terms.map((t) => `"${t}"`).join(" OR ");
}

export type { RedditPost };