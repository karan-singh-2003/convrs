export const BOT_CATEGORY = {
  ANSWER_AGENT: "answer_agent",
  INDEX_CRAWLER: "index_crawler",
  TRAINING_CRAWLER: "training_crawler",
  OTHER: "other",
} as const;

export type BotCategory = (typeof BOT_CATEGORY)[keyof typeof BOT_CATEGORY];

export interface BotMatch {
  vendor: string;
  agentName: string;
  category: BotCategory;
}

/**
 * How a crawler's identity can be confirmed beyond its (trivially spoofable)
 * User-Agent. `ip_ranges` = the vendor publishes a JSON list of CIDRs;
 * `rdns` = forward-confirmed reverse DNS must end in one of the suffixes;
 * `none` = the vendor publishes no verification method.
 */
export interface AgentVerification {
  method: "ip_ranges" | "rdns" | "none";
  ipRangeUrls?: string[];
  rdnsSuffixes?: string[];
}

/** One known crawler / agent in the canonical registry. */
export interface AgentDefinition {
  /** Lowercase product token as it appears in the User-Agent, e.g. "gptbot". */
  token: string;
  vendor: string;
  /** Human-readable name, e.g. "GPTBot". */
  name: string;
  category: BotCategory;
  /** Short description of what the vendor says the agent is used for. */
  purpose: string;
  verification: AgentVerification;
  /** Vendor documentation for the agent, when published. */
  docs?: string;
}

/** How a classification was reached, most to least specific. */
export type MatchType = "exact" | "fallback" | "generic";

export interface BotClassification extends BotMatch {
  matchType: MatchType;
  /** Display name ("GPTBot"); "Unknown bot" for generic matches. */
  name: string;
  purpose: string;
  verification: AgentVerification;
  classifierVersion: string;
}

export interface MinimalRequest {
  url: string;
  method: string;
  headers: {
    get(name: string): string | null;
  };
  /**
   * Client IP already resolved by a framework that knows its own proxy chain
   * (e.g. Express `req.ip` with `trust proxy` configured). Used by the
   * default `ipSource: "auto"`.
   */
  ip?: string | null;
  /**
   * Cloudflare Workers/Pages attach request metadata here. Its presence means
   * the request came through Cloudflare's edge, so `cf-connecting-ip` was set
   * by Cloudflare (the default `ipSource: "auto"` uses it).
   */
  cf?: unknown;
}

/**
 * Where the crawler's IP comes from. Forwarding headers are only trustworthy
 * when the named infrastructure sits in front of you and overwrites them:
 *
 * - `auto` — Vercel when running on Vercel, otherwise `request.ip` from an
 *   adapter that resolved it (Express with `trust proxy`), otherwise unknown.
 * - `vercel` — `x-vercel-forwarded-for` / `x-real-ip` (set by Vercel's edge).
 * - `cloudflare` — `cf-connecting-ip`. Only correct when your origin accepts
 *   traffic exclusively from Cloudflare.
 * - `x-forwarded-for` — first hop of X-Forwarded-For. Only correct behind a
 *   proxy you control that strips client-supplied values.
 * - `none` — never send an IP.
 */
export type IpSource = "auto" | "vercel" | "cloudflare" | "x-forwarded-for" | "none";

export interface EdgeGeo {
  country?: string;
  region?: string;
  city?: string;
  source: "vercel" | "cloudflare";
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    keepalive?: boolean;
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number }>;

export interface WaitUntilLike {
  waitUntil: (promise: Promise<unknown>) => void;
}

export type WaitUntilTarget = ((promise: Promise<unknown>) => void) | WaitUntilLike;

export interface ResponseLike {
  status?: number;
  statusCode?: number;
}

export interface TrackEventContext {
  waitUntil?: (promise: Promise<unknown>) => void;
  response?: ResponseLike;
  statusCode?: number;
}

export interface ConvrsBotConfig {
  /** Your Convrs website/project id (the `data-website-id` value). Required unless `siteId` is set. */
  websiteId?: string;
  /** Same as `websiteId` (original 1.0 name). */
  siteId?: string;
  /** Master switch, defaults to true. */
  enabled?: boolean;
  /** Override the ingest endpoint (mostly for testing / self-hosting). */
  endpoint?: string;
  /** Request timeout in ms before the tracking call is aborted. Default 1000. */
  timeoutMs?: number;
  /**
   * Optional hardening. Your website's bot-traffic token (`cvbot_…`, from
   * Settings → Script → Bot traffic) or an API token. Not needed by default:
   * `websiteId` alone identifies the website. When set, events are marked
   * authenticated; it is required only if "Reject unauthenticated requests"
   * is on. Sent only as an `Authorization: Bearer` header — keep it in a
   * server-side environment variable.
   */
  authToken?: string;
  /** HTTP methods eligible for tracking. Default ["GET", "HEAD"]. */
  trackedMethods?: string[];
  /** Skip index/search crawlers (Googlebot, Bingbot, etc). Default false (tracked). */
  skipIndexCrawlers?: boolean;
  /** Skip real-time answer agents (ChatGPT-User, Perplexity-User, etc). */
  skipAnswerAgents?: boolean;
  /** Skip dataset/training crawlers (GPTBot, CCBot, etc). */
  skipTrainingCrawlers?: boolean;
  /** Skip everything not otherwise categorized. */
  skipOtherBots?: boolean;
  /** Alias of `skipAnswerAgents` (DataFast-compatible option name). */
  disableAnswerFetch?: boolean;
  /** Alias of `skipIndexCrawlers` (DataFast-compatible option name). */
  disableSearchCrawlers?: boolean;
  /** Alias of `skipTrainingCrawlers` (DataFast-compatible option name). */
  disableTrainingCrawlers?: boolean;
  /** Alias of `skipOtherBots` (DataFast-compatible option name). */
  disableOtherCrawlers?: boolean;
  /** Replace the default ignored path prefix list entirely. */
  ignoredPathPrefixes?: string[];
  /** Append extra prefixes to the default ignore list. */
  extraIgnoredPathPrefixes?: string[];
  /** Replace the default ignored extension list entirely. */
  ignoredExtensions?: string[];
  /** Append extra extensions to the default ignore list. */
  extraIgnoredExtensions?: string[];
  /** Cap on tracked URL length. Default 8192. */
  maxUrlLength?: number;
  /** Force the hostname/domain reported, instead of reading it from the request. */
  domain?: string;
  /** Rewrite the request URL to a public-facing origin (useful behind proxies/tunnels). */
  publicOrigin?: string;
  /** Custom fetch implementation (Node < 18, custom runtimes, tests). */
  fetch?: FetchLike;
  /** Extract client IP yourself instead of relying on common proxy headers. */
  resolveIp?: (request: MinimalRequest) => string | null | undefined;
  /** Which infrastructure header to trust for the crawler IP. Default "auto". */
  ipSource?: IpSource;
  /**
   * Query parameter names to keep in the reported URL. By default the query
   * string is dropped entirely, because it can carry secrets or PII.
   * Use ["*"] to keep every parameter.
   */
  keepQueryParams?: string[];
  /**
   * Paths (exact, or prefix when ending in "/") that this integration must
   * never report — not even always-tracked crawler files. Use it to avoid
   * double-counting paths that a `withBotTracking` route handler already
   * reports with an exact status code.
   */
  excludePaths?: string[];
  /** Final say on whether a given URL/bot combination should be tracked. */
  filter?: (url: URL, bot: BotMatch) => boolean;
  /** Log internal errors/skips to the console. */
  debug?: boolean;
}

export type SkipReason =
  | "disabled"
  | "missing_site_id"
  | "method_not_tracked"
  | "not_a_bot"
  | "index_crawler_skipped"
  | "answer_agent_skipped"
  | "training_crawler_skipped"
  | "other_bot_skipped"
  | "invalid_url"
  | "url_too_long"
  | "static_asset_fetch"
  | "ignored_path"
  | "ignored_extension"
  | "excluded_path"
  | "filtered_out";

export interface TrackDecision {
  shouldTrack: boolean;
  bot?: BotMatch;
  /** Full classification (registry metadata); present whenever `bot` is. */
  classification?: BotClassification;
  /** Stable ID for this tracked request, reused by every send of this decision. */
  eventId?: string;
  url?: URL;
  skipReason?: SkipReason;
}

export interface TrackOutcome {
  sent: boolean;
  queued?: boolean;
  bot?: BotMatch;
  skipReason?: SkipReason;
  httpStatus?: number;
  error?: "send_failed" | "no_fetch_available";
}
