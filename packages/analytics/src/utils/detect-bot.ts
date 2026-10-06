import { classifyUserAgent, type BotClassification } from "@convrs/ai-bot-sdk";
import { IP_BOTS, IP_RANGES_BOTS, REFERRER_BOTS, UA_BOTS } from "./bots-list";
import { isIpInRange } from "./is-ip-in-range";
import { parseUserAgent } from "./parse-user-agent";
import { getIpAddress } from "./get-ip-address";

export type BotReason =
  | "query_param"
  | "head_request"
  | "known_crawler"
  | "user_agent"
  | "referer"
  | "ip";

export interface BotSignals {
  userAgent: string | null | undefined;
  referer?: string | null;
  /** Client IP from a trusted source; pass null when unknown. */
  ip?: string | null;
  method?: string;
  url?: string;
}

export interface BotDetection {
  isBot: boolean;
  reason?: BotReason;
  /**
   * Canonical classification from @convrs/ai-bot-sdk — the same classifier
   * /api/ai-crawls uses — when the User-Agent is a known or generic crawler.
   */
  crawler?: BotClassification;
}

const UA_BOT_PATTERNS = UA_BOTS.map((bot) => new RegExp(bot, "i"));
const REFERRER_BOT_PATTERNS = REFERRER_BOTS.map((bot) => new RegExp(bot, "i"));

export function detectBotSignals(signals: BotSignals): BotDetection {
  if (signals.url) {
    try {
      if (new URL(signals.url).searchParams.get("bot")) {
        return { isBot: true, reason: "query_param" };
      }
    } catch {}
  }

  // HEAD requests are generally from bots, real users will always use GET requests
  if (signals.method?.toUpperCase() === "HEAD") {
    return { isBot: true, reason: "head_request" };
  }

  const uaString = signals.userAgent || "";
  const crawler = classifyUserAgent(uaString);
  if (crawler) {
    return { isBot: true, reason: "known_crawler", crawler };
  }

  const ua = parseUserAgent(uaString);
  if (ua.isBot || UA_BOT_PATTERNS.some((re) => re.test(ua.ua))) {
    return { isBot: true, reason: "user_agent" };
  }

  const referer = signals.referer;
  if (referer && REFERRER_BOT_PATTERNS.some((re) => re.test(referer))) {
    return { isBot: true, reason: "referer" };
  }

  const ip = signals.ip;
  if (ip && (IP_BOTS.includes(ip) || IP_RANGES_BOTS.some((range) => isIpInRange(ip, range)))) {
    return { isBot: true, reason: "ip" };
  }

  return { isBot: false };
}

/**
 * Request-based wrapper. `options.ip` overrides the header-derived IP —
 * callers that know the trusted client IP (apps/ingestion) must pass it,
 * since the header fallback reads client-forgeable forwarding headers.
 */
export const detectBot = (req: Request, options: { ip?: string | null } = {}) =>
  detectBotSignals({
    userAgent: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
    ip: options.ip !== undefined ? options.ip : getIpAddress(req),
    method: req.method,
    url: req.url,
  }).isBot;
