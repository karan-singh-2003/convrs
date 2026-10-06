import { BOT_CATEGORY, type AgentDefinition, type AgentVerification, type BotCategory } from "./types";

/**
 * Bump whenever the registry or matching rules change in a way that can
 * re-label traffic, so stored events record which rules produced them.
 */
export const CLASSIFIER_VERSION = "2026.10.1";

// ── Verification sources ────────────────────────────────────────────────────
// Every URL below was confirmed to exist and to use the shared
// `{ prefixes: [{ ipv4Prefix | ipv6Prefix }] }` format on 2026-10-06.

const GOOGLE_RDNS = ["googlebot.com", "google.com", "googleusercontent.com"];
const GOOGLE_COMMON: AgentVerification = {
  method: "ip_ranges",
  ipRangeUrls: ["https://developers.google.com/static/search/apis/ipranges/googlebot.json"],
  rdnsSuffixes: GOOGLE_RDNS,
};
const GOOGLE_SPECIAL: AgentVerification = {
  method: "ip_ranges",
  ipRangeUrls: ["https://developers.google.com/static/search/apis/ipranges/special-crawlers.json"],
  rdnsSuffixes: GOOGLE_RDNS,
};
const GOOGLE_USER_TRIGGERED: AgentVerification = {
  method: "ip_ranges",
  ipRangeUrls: [
    "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json",
    "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
  ],
  rdnsSuffixes: GOOGLE_RDNS,
};
const BING: AgentVerification = {
  method: "ip_ranges",
  ipRangeUrls: ["https://www.bing.com/toolbox/bingbot.json"],
  rdnsSuffixes: ["search.msn.com"],
};
const ranges = (...ipRangeUrls: string[]): AgentVerification => ({ method: "ip_ranges", ipRangeUrls });
const rdns = (...rdnsSuffixes: string[]): AgentVerification => ({ method: "rdns", rdnsSuffixes });
const NONE: AgentVerification = { method: "none" };

const { ANSWER_AGENT, INDEX_CRAWLER, TRAINING_CRAWLER, OTHER } = BOT_CATEGORY;

/**
 * The single source of truth for known crawlers. Used by this SDK (to decide
 * what to report), by Convrs ingestion (to re-classify every reported event —
 * client-supplied labels are never trusted), and by Convrs's human-analytics
 * bot filter (so a crawler can never be counted as a visitor).
 *
 * Notes on deliberate omissions:
 * - `Google-Extended` and `Applebot-Extended` are robots.txt control tokens,
 *   not User-Agents; no request ever carries them.
 * - "Copilot" has no published crawler UA; it is only a constrained fallback hint.
 */
export const AGENTS: AgentDefinition[] = [
  // OpenAI
  { token: "chatgpt-user", vendor: "OpenAI", name: "ChatGPT-User", category: ANSWER_AGENT, purpose: "Fetches pages when a ChatGPT user asks about them", verification: ranges("https://openai.com/chatgpt-user.json"), docs: "https://platform.openai.com/docs/bots" },
  { token: "oai-searchbot", vendor: "OpenAI", name: "OAI-SearchBot", category: INDEX_CRAWLER, purpose: "Indexes pages for ChatGPT search results", verification: ranges("https://openai.com/searchbot.json"), docs: "https://platform.openai.com/docs/bots" },
  { token: "gptbot", vendor: "OpenAI", name: "GPTBot", category: TRAINING_CRAWLER, purpose: "Collects content to train OpenAI models", verification: ranges("https://openai.com/gptbot.json"), docs: "https://platform.openai.com/docs/bots" },
  { token: "oai-adsbot", vendor: "OpenAI", name: "OAI-AdsBot", category: OTHER, purpose: "Checks landing pages of ads", verification: NONE },

  // Anthropic (no published IP ranges)
  { token: "claude-user", vendor: "Anthropic", name: "Claude-User", category: ANSWER_AGENT, purpose: "Fetches pages when a Claude user asks about them", verification: NONE, docs: "https://support.anthropic.com" },
  { token: "claude-searchbot", vendor: "Anthropic", name: "Claude-SearchBot", category: INDEX_CRAWLER, purpose: "Indexes pages for Claude search results", verification: NONE },
  { token: "claudebot", vendor: "Anthropic", name: "ClaudeBot", category: TRAINING_CRAWLER, purpose: "Collects content to train Anthropic models", verification: NONE },
  { token: "claude-web", vendor: "Anthropic", name: "Claude-Web", category: OTHER, purpose: "Legacy Anthropic fetcher", verification: NONE },
  { token: "anthropic-ai", vendor: "Anthropic", name: "anthropic-ai", category: OTHER, purpose: "Legacy Anthropic crawler", verification: NONE },

  // Perplexity
  { token: "perplexity-user", vendor: "Perplexity", name: "Perplexity-User", category: ANSWER_AGENT, purpose: "Fetches pages when a Perplexity user asks about them", verification: ranges("https://www.perplexity.com/perplexity-user.json"), docs: "https://docs.perplexity.ai/guides/bots" },
  { token: "perplexitybot", vendor: "Perplexity", name: "PerplexityBot", category: INDEX_CRAWLER, purpose: "Indexes pages for Perplexity search", verification: ranges("https://www.perplexity.com/perplexitybot.json"), docs: "https://docs.perplexity.ai/guides/bots" },

  // Google
  { token: "googlebot", vendor: "Google", name: "Googlebot", category: INDEX_CRAWLER, purpose: "Google Search crawler", verification: GOOGLE_COMMON, docs: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers" },
  { token: "google-inspectiontool", vendor: "Google", name: "Google-InspectionTool", category: INDEX_CRAWLER, purpose: "Search Console URL inspection", verification: GOOGLE_COMMON },
  { token: "storebot-google", vendor: "Google", name: "Storebot-Google", category: INDEX_CRAWLER, purpose: "Google Shopping crawler", verification: GOOGLE_COMMON },
  { token: "googleother", vendor: "Google", name: "GoogleOther", category: OTHER, purpose: "Generic Google crawler for research and one-off fetches", verification: GOOGLE_COMMON },
  { token: "google-cloudvertexbot", vendor: "Google", name: "Google-CloudVertexBot", category: OTHER, purpose: "Crawls at a site owner's request for Vertex AI agents", verification: GOOGLE_COMMON },
  { token: "adsbot-google", vendor: "Google", name: "AdsBot-Google", category: OTHER, purpose: "Checks ad landing page quality", verification: GOOGLE_SPECIAL },
  { token: "mediapartners-google", vendor: "Google", name: "Mediapartners-Google", category: OTHER, purpose: "AdSense content analysis", verification: GOOGLE_SPECIAL },
  { token: "apis-google", vendor: "Google", name: "APIs-Google", category: OTHER, purpose: "Push notification delivery", verification: GOOGLE_SPECIAL },
  { token: "google-safety", vendor: "Google", name: "Google-Safety", category: OTHER, purpose: "Abuse and malware discovery", verification: GOOGLE_SPECIAL },
  { token: "google-read-aloud", vendor: "Google", name: "Google-Read-Aloud", category: ANSWER_AGENT, purpose: "Reads pages aloud at a user's request", verification: GOOGLE_USER_TRIGGERED },
  { token: "google-notebooklm", vendor: "Google", name: "Google-NotebookLM", category: ANSWER_AGENT, purpose: "Fetches sources a NotebookLM user added", verification: GOOGLE_USER_TRIGGERED },
  { token: "google-agent", vendor: "Google", name: "Google-Agent", category: ANSWER_AGENT, purpose: "Fetches pages for a Google AI agent acting for a user", verification: GOOGLE_USER_TRIGGERED },
  { token: "googleagent", vendor: "Google", name: "GoogleAgent", category: ANSWER_AGENT, purpose: "Fetches pages for a Google AI agent acting for a user", verification: GOOGLE_USER_TRIGGERED },
  { token: "feedfetcher-google", vendor: "Google", name: "FeedFetcher-Google", category: OTHER, purpose: "RSS/Atom feed fetcher", verification: GOOGLE_USER_TRIGGERED },
  { token: "google-site-verification", vendor: "Google", name: "Google-Site-Verification", category: OTHER, purpose: "Search Console ownership checks", verification: GOOGLE_USER_TRIGGERED },
  { token: "google favicon", vendor: "Google", name: "Google Favicon", category: OTHER, purpose: "Favicon fetcher", verification: GOOGLE_USER_TRIGGERED },

  // Microsoft
  { token: "bingbot", vendor: "Microsoft", name: "Bingbot", category: INDEX_CRAWLER, purpose: "Bing Search crawler (also grounds Copilot answers)", verification: BING, docs: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0" },
  { token: "msnbot", vendor: "Microsoft", name: "MSNBot", category: INDEX_CRAWLER, purpose: "Legacy Bing crawler", verification: BING },
  { token: "bingpreview", vendor: "Microsoft", name: "BingPreview", category: OTHER, purpose: "Bing page snapshots", verification: BING },
  { token: "adidxbot", vendor: "Microsoft", name: "AdIdxBot", category: OTHER, purpose: "Bing Ads landing page checks", verification: BING },

  // Apple — Applebot powers Siri/Spotlight search. Training opt-out is the
  // robots-only "Applebot-Extended" token, which never appears in requests.
  { token: "applebot", vendor: "Apple", name: "Applebot", category: INDEX_CRAWLER, purpose: "Apple search (Siri, Spotlight, Safari suggestions)", verification: rdns("applebot.apple.com"), docs: "https://support.apple.com/en-us/119829" },

  // Amazon
  { token: "amazonbot", vendor: "Amazon", name: "Amazonbot", category: TRAINING_CRAWLER, purpose: "Improves Amazon services, may be used for model training", verification: NONE },
  { token: "amzn-searchbot", vendor: "Amazon", name: "Amzn-SearchBot", category: INDEX_CRAWLER, purpose: "Amazon search indexing", verification: NONE },
  { token: "amzn-user", vendor: "Amazon", name: "Amzn-User", category: ANSWER_AGENT, purpose: "Fetches pages on behalf of an Alexa user", verification: NONE },

  // DuckDuckGo
  { token: "duckassistbot", vendor: "DuckDuckGo", name: "DuckAssistBot", category: ANSWER_AGENT, purpose: "Fetches pages for DuckAssist answers", verification: ranges("https://duckduckgo.com/duckassistbot.json") },
  { token: "duckduckbot", vendor: "DuckDuckGo", name: "DuckDuckBot", category: INDEX_CRAWLER, purpose: "DuckDuckGo search crawler", verification: NONE },

  // xAI — bare "grok" is only a constrained fallback hint (see FALLBACK_VENDOR_HINTS)
  { token: "xai-searchbot", vendor: "xAI", name: "xAI-SearchBot", category: ANSWER_AGENT, purpose: "Fetches pages for Grok answers", verification: NONE },
  { token: "grok-deepsearch", vendor: "xAI", name: "Grok-DeepSearch", category: ANSWER_AGENT, purpose: "Fetches pages for Grok DeepSearch", verification: NONE },
  { token: "grokbot", vendor: "xAI", name: "GrokBot", category: OTHER, purpose: "xAI crawler", verification: NONE },
  { token: "xai-bot", vendor: "xAI", name: "xAI-Bot", category: OTHER, purpose: "xAI crawler", verification: NONE },
  { token: "xai-grok", vendor: "xAI", name: "xAI-Grok", category: OTHER, purpose: "xAI crawler", verification: NONE },
  { token: "xai-web-crawler", vendor: "xAI", name: "xAI-Web-Crawler", category: OTHER, purpose: "xAI crawler", verification: NONE },

  // Meta (no published per-agent IP list)
  { token: "meta-externalagent", vendor: "Meta", name: "Meta-ExternalAgent", category: TRAINING_CRAWLER, purpose: "Collects content to train Meta AI models", verification: NONE, docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers" },
  { token: "meta-externalfetcher", vendor: "Meta", name: "Meta-ExternalFetcher", category: ANSWER_AGENT, purpose: "Fetches pages a Meta AI user asked about", verification: NONE },
  { token: "facebookexternalhit", vendor: "Meta", name: "facebookexternalhit", category: OTHER, purpose: "Link previews on Facebook/Instagram/Messenger", verification: NONE },
  { token: "facebookcatalog", vendor: "Meta", name: "facebookcatalog", category: OTHER, purpose: "Product catalog crawler", verification: NONE },
  { token: "facebookbot", vendor: "Meta", name: "FacebookBot", category: OTHER, purpose: "Meta crawler", verification: NONE },

  // Mistral
  { token: "mistralai-user", vendor: "Mistral", name: "MistralAI-User", category: ANSWER_AGENT, purpose: "Fetches pages for Le Chat users", verification: NONE },
  { token: "mistralai-index", vendor: "Mistral", name: "MistralAI-Index", category: INDEX_CRAWLER, purpose: "Mistral search indexing", verification: NONE },

  // Moonshot AI
  { token: "kimi-user", vendor: "Moonshot AI", name: "Kimi-User", category: ANSWER_AGENT, purpose: "Fetches pages for Kimi users", verification: NONE },
  { token: "kimi-searchbot", vendor: "Moonshot AI", name: "Kimi-SearchBot", category: INDEX_CRAWLER, purpose: "Kimi search indexing", verification: NONE },
  { token: "kimibot", vendor: "Moonshot AI", name: "KimiBot", category: TRAINING_CRAWLER, purpose: "Moonshot AI training crawler", verification: NONE },

  // ByteDance
  { token: "bytespider", vendor: "ByteDance", name: "Bytespider", category: TRAINING_CRAWLER, purpose: "Collects content to train ByteDance models", verification: NONE },
  { token: "tiktokspider", vendor: "ByteDance", name: "TikTokSpider", category: INDEX_CRAWLER, purpose: "TikTok search indexing", verification: NONE },
  { token: "doubaobot", vendor: "ByteDance", name: "DoubaoBot", category: OTHER, purpose: "Doubao assistant crawler", verification: NONE },

  // Baidu
  { token: "baiduspider", vendor: "Baidu", name: "Baiduspider", category: INDEX_CRAWLER, purpose: "Baidu search crawler", verification: rdns("baidu.com", "baidu.jp") },
  { token: "erniebot", vendor: "Baidu", name: "ErnieBot", category: TRAINING_CRAWLER, purpose: "Baidu ERNIE model crawler", verification: NONE },
  { token: "yiyanbot", vendor: "Baidu", name: "YiyanBot", category: OTHER, purpose: "Baidu assistant crawler", verification: NONE },

  // Alibaba
  { token: "qwen-user", vendor: "Alibaba", name: "Qwen-User", category: ANSWER_AGENT, purpose: "Fetches pages for Qwen users", verification: NONE },
  { token: "qwenbot", vendor: "Alibaba", name: "QwenBot", category: TRAINING_CRAWLER, purpose: "Qwen model crawler", verification: NONE },
  { token: "tongyibot", vendor: "Alibaba", name: "TongyiBot", category: OTHER, purpose: "Tongyi crawler", verification: NONE },
  { token: "aliyunbot", vendor: "Alibaba", name: "AliyunBot", category: OTHER, purpose: "Alibaba Cloud crawler", verification: NONE },

  // Others
  { token: "chatglm-spider", vendor: "Zhipu AI", name: "ChatGLM-Spider", category: TRAINING_CRAWLER, purpose: "Zhipu model crawler", verification: NONE },
  { token: "deepseekbot", vendor: "DeepSeek", name: "DeepSeekBot", category: TRAINING_CRAWLER, purpose: "DeepSeek model crawler", verification: NONE },
  { token: "cohere-ai", vendor: "Cohere", name: "cohere-ai", category: TRAINING_CRAWLER, purpose: "Cohere crawler", verification: NONE },
  { token: "cohere-training-data-crawler", vendor: "Cohere", name: "cohere-training-data-crawler", category: TRAINING_CRAWLER, purpose: "Cohere training data crawler", verification: NONE },
  { token: "ai2bot", vendor: "Allen Institute for AI", name: "AI2Bot", category: TRAINING_CRAWLER, purpose: "Open model training crawler", verification: NONE },
  { token: "youbot", vendor: "You.com", name: "YouBot", category: INDEX_CRAWLER, purpose: "You.com search crawler", verification: NONE },
  { token: "ccbot", vendor: "Common Crawl", name: "CCBot", category: TRAINING_CRAWLER, purpose: "Open web crawl widely used for model training", verification: ranges("https://index.commoncrawl.org/ccbot.json"), docs: "https://commoncrawl.org/ccbot" },
  { token: "yandexbot", vendor: "Yandex", name: "YandexBot", category: INDEX_CRAWLER, purpose: "Yandex search crawler", verification: rdns("yandex.ru", "yandex.net", "yandex.com") },
  { token: "slurp", vendor: "Yahoo", name: "Yahoo! Slurp", category: INDEX_CRAWLER, purpose: "Yahoo search crawler", verification: rdns("crawl.yahoo.net") },
  { token: "petalbot", vendor: "Huawei", name: "PetalBot", category: INDEX_CRAWLER, purpose: "Petal search crawler", verification: NONE },
  { token: "sogou web spider", vendor: "Sogou", name: "Sogou web spider", category: INDEX_CRAWLER, purpose: "Sogou search crawler", verification: NONE },
  { token: "twitterbot", vendor: "X", name: "Twitterbot", category: OTHER, purpose: "Link previews on X", verification: NONE },
  { token: "linkedinbot", vendor: "LinkedIn", name: "LinkedInBot", category: OTHER, purpose: "Link previews on LinkedIn", verification: NONE },
  { token: "slackbot", vendor: "Slack", name: "Slackbot", category: OTHER, purpose: "Link previews in Slack", verification: NONE },
  { token: "discordbot", vendor: "Discord", name: "Discordbot", category: OTHER, purpose: "Link previews in Discord", verification: NONE },
  { token: "whatsapp", vendor: "Meta", name: "WhatsApp", category: OTHER, purpose: "Link previews in WhatsApp", verification: NONE },
];

/** Back-compat shape of the 1.0.x registry, derived from AGENTS. */
export interface VendorEntry {
  vendor: string;
  bots: Array<{ token: string; category: BotCategory }>;
}

export const KNOWN_VENDORS: VendorEntry[] = AGENTS.reduce<VendorEntry[]>((acc, agent) => {
  let entry = acc.find((e) => e.vendor === agent.vendor);
  if (!entry) {
    entry = { vendor: agent.vendor, bots: [] };
    acc.push(entry);
  }
  entry.bots.push({ token: agent.token, category: agent.category });
  return acc;
}, []);

/** Flattened lookup table built once at module load time. */
export const BOT_TOKEN_TABLE = AGENTS.map((agent) => ({
  vendor: agent.vendor,
  token: agent.token,
  category: agent.category,
}));

/**
 * Vendor-name hints for crawlers whose exact UA isn't registered yet. They
 * only apply when the UA also looks automated (see classify.ts) so that,
 * for example, a desktop app whose UA mentions "Claude" or a browser
 * extension mentioning "Copilot" is never labelled a crawler. Purpose is
 * unknown for these, so the category is always "other".
 */
export const FALLBACK_VENDOR_HINTS: Array<{
  vendor: string;
  category: BotCategory;
  hints: string[];
}> = [
  { vendor: "OpenAI", category: OTHER, hints: ["openai", "chatgpt", "oai-"] },
  { vendor: "Anthropic", category: OTHER, hints: ["anthropic", "claude"] },
  { vendor: "Perplexity", category: OTHER, hints: ["perplexity"] },
  { vendor: "Google", category: OTHER, hints: ["google", "gemini"] },
  { vendor: "Microsoft", category: OTHER, hints: ["bing", "msn", "copilot"] },
  { vendor: "Apple", category: OTHER, hints: ["applebot"] },
  { vendor: "Amazon", category: OTHER, hints: ["amazon", "amzn-"] },
  { vendor: "DuckDuckGo", category: OTHER, hints: ["duckduck", "duckassist"] },
  { vendor: "xAI", category: OTHER, hints: ["xai", "x-ai", "grok"] },
  { vendor: "Meta", category: OTHER, hints: ["meta-external", "facebook"] },
  { vendor: "Mistral", category: OTHER, hints: ["mistral"] },
  { vendor: "Moonshot AI", category: OTHER, hints: ["kimi", "moonshot"] },
  { vendor: "ByteDance", category: OTHER, hints: ["bytedance", "doubao", "tiktok"] },
  { vendor: "Baidu", category: OTHER, hints: ["baidu", "ernie"] },
  { vendor: "Alibaba", category: OTHER, hints: ["qwen", "tongyi", "aliyun"] },
  { vendor: "Zhipu AI", category: OTHER, hints: ["chatglm", "zhipu"] },
  { vendor: "DeepSeek", category: OTHER, hints: ["deepseek"] },
  { vendor: "Cohere", category: OTHER, hints: ["cohere"] },
  { vendor: "Allen Institute for AI", category: OTHER, hints: ["allenai"] },
  { vendor: "You.com", category: OTHER, hints: ["you.com"] },
  { vendor: "Common Crawl", category: OTHER, hints: ["commoncrawl"] },
  { vendor: "Yandex", category: OTHER, hints: ["yandex"] },
];

/**
 * Generic automation markers (case-insensitive substrings). Anything that
 * matches but isn't a known agent is classified as `other` / `unknown_bot`
 * instead of disappearing. Moved here from packages/analytics' bots-list so
 * human-analytics filtering and crawler reporting share one list. Vendor
 * names that used to live here ("google", "bing", "chatgpt", …) are now
 * covered by AGENTS / FALLBACK_VENDOR_HINTS with tighter matching.
 */
export const GENERIC_BOT_PATTERNS: string[] = [
  // generic UA name patterns
  "bot", "crawler", "crawl", "spider", "scraper", "slurp", "http", "fetch",
  // HTTP clients and automation runtimes
  "curl", "wget", "python", "node", "ruby", "go-http", "java/", "okhttp",
  "axios", "guzzle", "postman", "insomnia", "newman", "scrapy", "libwww",
  "headlesschrome", "phantomjs", "puppeteer", "playwright", "selenium",
  // link previewers / embeds
  "bluesky", "thirdlandingpagefeinfra", "metainspector", "iframely",
  "skypeuripreview", "vkshare", "tumblr", "embedly", "shortlinktranslate",
  // search / archives
  "duckduckbot", "teoma", "yandex", "ia_archiver", "sogou", "qwantify",
  "wayback", "heritrix", "nutch", "omigili", "timpi",
  // monitoring / uptime
  "feedburner", "upptime", "hyperping", "cron-job", "internetmeasurement",
  "hosttracker", "expanse", "gtmetrix", "pingdom", "statuscake", "site24x7",
  "monitis", "gomez", "neustar", "catchpoint", "webpagetest", "speedcurve",
  "dareboost", "yellowlab",
  // SEO tools
  "seokicks", "sistrix", "searchmetrics", "linkdex", "opensiteexplorer",
  "spyfu", "serpstat", "cognitiveseo", "seobility", "seositecheckup", "woorank",
  // link checkers / audits
  "linkchecker", "deadlinkchecker", "brokenlinkcheck", "xenu", "scrutiny",
  "powermapper", "siteimprove", "monsido",
];

/**
 * Real devices/browsers whose UA happens to contain a generic pattern
 * (e.g. CUBOT phones contain "bot"). Matching substrings are removed from
 * the UA before generic matching, so "CUBOT_X30" stays a browser while a
 * crawler UA that also happens to contain one is still caught.
 */
export const GENERIC_PATTERN_EXCEPTIONS: RegExp[] = [/cubot/gi];

export const DEFAULT_IGNORED_PATH_PREFIXES = [
  "/api",
  "/_next",
  "/_nuxt",
  "/_astro",
  "/static",
  "/assets",
  "/public",
  "/images",
  "/img",
  "/fonts",
  "/favicon",
  "/build",
  "/dist",
  "/admin",
  "/webhook",
  "/webhooks",
  "/cdn-cgi",
  "/.well-known",
];

export const DEFAULT_IGNORED_EXTENSIONS = [
  "avif", "bmp", "br", "cjs", "css", "csv", "eot", "gif", "gz", "ico",
  "jpeg", "jpg", "js", "json", "map", "mjs", "mov", "mp3", "mp4", "otf",
  "pdf", "png", "svg", "ttf", "txt", "wasm", "wav", "webm", "webmanifest",
  "webp", "woff", "woff2", "xml", "zip",
];

/** Paths that bots fetch on purpose and that should always be tracked. */
export const ALWAYS_TRACKED_PATHS = new Set(["/robots.txt", "/llms.txt", "/llms-full.txt"]);

/** sec-fetch-dest values that indicate a sub-resource fetch, not a page visit. */
export const SUBRESOURCE_FETCH_DESTINATIONS = new Set([
  "audio", "embed", "font", "image", "manifest", "object",
  "script", "style", "track", "video", "worker",
]);
