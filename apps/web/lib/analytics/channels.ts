// lib/analytics/channels.ts

export type ChannelId =
  | "direct"
  | "organic_search"
  | "paid_search"
  | "organic_social"
  | "paid_social"
  | "email"
  | "sms"
  | "affiliate"
  | "display"
  | "referral"
  | "unknown";

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  direct: "Direct",
  organic_search: "Organic Search",
  paid_search: "Paid Search",
  organic_social: "Organic Social",
  paid_social: "Paid Social",
  email: "Email",
  sms: "SMS",
  affiliate: "Affiliate",
  display: "Display",
  referral: "Referral",
  unknown: "Unknown",
};

export const CHANNEL_COLORS: Record<ChannelId, string> = {
  direct: "text-neutral-400",
  organic_search: "text-blue-500",
  paid_search: "text-blue-700",
  organic_social: "text-purple-500",
  paid_social: "text-purple-700",
  email: "text-teal-500",
  sms: "text-teal-700",
  affiliate: "text-amber-500",
  display: "text-rose-500",
  referral: "text-neutral-500",
  unknown: "text-neutral-300",
};

const SEARCH_ENGINES = new Set([
  "google.com", "bing.com", "duckduckgo.com",
  "yahoo.com", "search.yahoo.com", "baidu.com", "yandex.com",
  "ecosia.org", "ask.com", "aol.com", "startpage.com",
]);

const SOCIAL_NETWORKS = new Set([
  "facebook.com", "m.facebook.com", "l.facebook.com",
  "instagram.com", "linkedin.com", "lnkd.in",
  "reddit.com", "old.reddit.com",
  "twitter.com", "x.com", "t.co",
  "tiktok.com", "pinterest.com", "snapchat.com",
  "youtube.com", "youtu.be",
  "threads.net", "mastodon.social", "bsky.app",
  "discord.com", "discordapp.com",
  "telegram.org", "t.me",
  "whatsapp.com", "wa.me",
  "producthunt.com",
]);

// Heuristic only — real classification needs utm_medium="email" from the
// tracked click, which the current referers groupBy endpoint doesn't return
// alongside referer. See classifyChannel's utm-aware path below.
const EMAIL_TOOLS = new Set([
  "list-manage.com", "campaign-archive.com", "substack.com",
  "convertkit.com", "buttondown.email", "mail.google.com",
  "sendgrid.net", "mailchimp.com", "klaviyo.com", "beehiiv.com",
]);

// SaaS/indie-hacker launch directories & listing sites. These are commonly
// tracked separately from generic "Referral" since they're a distinct,
// intentional acquisition channel (not organic backlinks).
const AFFILIATE_DIRECTORIES = new Set([
  "producthunt.com", "marclou.com", "trustmrr.com", "indiepa.ge",
  "shipfa.st", "indiepage.co", "betalist.com", "saashub.com",
  "alternativeto.net", "g2.com", "capterra.com", "getapp.com",
  "startupstash.com", "futurepedia.io", "theresanaiforthat.com",
]);

function normalizeHost(referer: string) {
  return referer.toLowerCase().replace(/^www\./, "");
}

/**
 * Classifies a channel. Pass utm_source/utm_medium when available (e.g. once
 * the referers groupBy endpoint is extended to include them) for accurate
 * paid vs. organic / email / sms detection. Falls back to referrer-domain
 * heuristics when UTM data isn't present — this is the current behavior
 * everywhere in the app today, and it can't reliably distinguish paid from
 * organic search/social, or catch SMS/display at all, without UTM.
 */
export function classifyChannel(
  referer?: string | null,
  utm?: { source?: string | null; medium?: string | null }
): ChannelId {
  const medium = utm?.medium?.toLowerCase();
  if (medium) {
    if (medium === "email" || medium === "newsletter") return "email";
    if (medium === "sms" || medium === "text") return "sms";
    if (medium === "cpc" || medium === "ppc" || medium === "paid" || medium === "paidsearch") return "paid_search";
    if (medium === "paidsocial" || medium === "social-paid") return "paid_social";
    if (medium === "display" || medium === "banner" || medium === "cpm") return "display";
    if (medium === "affiliate" || medium === "referral-paid") return "affiliate";
    if (medium === "social" || medium === "organic-social") return "organic_social";
    if (medium === "organic") return "organic_search";
    if (medium === "referral") return "referral";
  }

  if (!referer) return "direct";
  const host = normalizeHost(referer);

  if (AFFILIATE_DIRECTORIES.has(host)) return "affiliate";
  if (SEARCH_ENGINES.has(host)) return "organic_search";
  if (SOCIAL_NETWORKS.has(host)) return "organic_social";
  if (EMAIL_TOOLS.has(host)) return "email";
  return "referral";
}

// ── Display-name grouping ────────────────────────────────────────────────────

const REFERRER_MAP: Record<string, string> = {
  "t.co": "X",
  "x.com": "X",
  "twitter.com": "X",
  "google.com": "Google",
  "bing.com": "Bing",
  "duckduckgo.com": "DuckDuckGo",
  "facebook.com": "Facebook",
  "m.facebook.com": "Facebook",
  "l.facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "linkedin.com": "LinkedIn",
  "lnkd.in": "LinkedIn",
  "reddit.com": "Reddit",
  "news.ycombinator.com": "Hacker News",
  "github.com": "GitHub",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "indiepa.ge": "IndiePage",
  "shipfa.st": "ShipFast",
};

export function getReferrerDisplayName(referrer?: string | null) {
  if (!referrer) return "(direct)";
  return REFERRER_MAP[referrer] ?? referrer;
}