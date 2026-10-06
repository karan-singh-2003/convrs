import { classifyUserAgent } from "./classify";
import {
  hasIgnoredExtension,
  isAlwaysTrackedPath,
  isTrackedMethod,
  matchesExcludedPath,
  matchesIgnoredPrefix,
  normalizePathname,
  resolveIgnoredExtensions,
  resolveIgnoredPathPrefixes,
} from "./filters";
import { readHeader, resolveRequestUrl } from "./request-utils";
import { SUBRESOURCE_FETCH_DESTINATIONS } from "./registry";
import { BOT_CATEGORY, type ConvrsBotConfig, type MinimalRequest, type TrackDecision } from "./types";

const DEFAULT_MAX_URL_LENGTH = 8192;

/** `websiteId`, falling back to the 1.0 name `siteId`. */
export function resolveSiteId(config: ConvrsBotConfig): string | undefined {
  return config.websiteId || config.siteId || undefined;
}

/** RFC 4122 v4 UUID; uses the platform CSPRNG when present. */
export function newEventId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Cheap, synchronous gate. Runs on every request, so it does no I/O: it only
 * classifies the User-Agent and applies path/method filters.
 */
export function decideWhetherToTrack(request: MinimalRequest, config: ConvrsBotConfig): TrackDecision {
  if (config.enabled === false) {
    return { shouldTrack: false, skipReason: "disabled" };
  }
  if (!resolveSiteId(config)) {
    return { shouldTrack: false, skipReason: "missing_site_id" };
  }
  if (!isTrackedMethod(request.method, config.trackedMethods)) {
    return { shouldTrack: false, skipReason: "method_not_tracked" };
  }

  const classification = classifyUserAgent(readHeader(request, "user-agent"));
  if (!classification) {
    return { shouldTrack: false, skipReason: "not_a_bot" };
  }
  const bot = {
    vendor: classification.vendor,
    agentName: classification.agentName,
    category: classification.category,
  };

  if ((config.skipIndexCrawlers || config.disableSearchCrawlers) && bot.category === BOT_CATEGORY.INDEX_CRAWLER) {
    return { shouldTrack: false, bot, classification, skipReason: "index_crawler_skipped" };
  }
  if ((config.skipAnswerAgents || config.disableAnswerFetch) && bot.category === BOT_CATEGORY.ANSWER_AGENT) {
    return { shouldTrack: false, bot, classification, skipReason: "answer_agent_skipped" };
  }
  if (
    (config.skipTrainingCrawlers || config.disableTrainingCrawlers) &&
    bot.category === BOT_CATEGORY.TRAINING_CRAWLER
  ) {
    return { shouldTrack: false, bot, classification, skipReason: "training_crawler_skipped" };
  }
  if ((config.skipOtherBots || config.disableOtherCrawlers) && bot.category === BOT_CATEGORY.OTHER) {
    return { shouldTrack: false, bot, classification, skipReason: "other_bot_skipped" };
  }

  const url = resolveRequestUrl(request, config);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return { shouldTrack: false, bot, classification, skipReason: "invalid_url" };
  }
  if (url.href.length > (config.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH)) {
    return { shouldTrack: false, bot, classification, skipReason: "url_too_long" };
  }

  const fetchDest = (readHeader(request, "sec-fetch-dest") ?? "").toLowerCase();
  if (SUBRESOURCE_FETCH_DESTINATIONS.has(fetchDest)) {
    return { shouldTrack: false, bot, classification, skipReason: "static_asset_fetch" };
  }

  const pathname = normalizePathname(url.pathname);

  if (matchesExcludedPath(pathname, config.excludePaths)) {
    return { shouldTrack: false, bot, classification, skipReason: "excluded_path" };
  }

  if (!isAlwaysTrackedPath(pathname)) {
    const ignoredPrefixes = resolveIgnoredPathPrefixes(config);
    if (ignoredPrefixes.some((prefix) => matchesIgnoredPrefix(pathname, prefix))) {
      return { shouldTrack: false, bot, classification, skipReason: "ignored_path" };
    }
    if (hasIgnoredExtension(pathname, resolveIgnoredExtensions(config))) {
      return { shouldTrack: false, bot, classification, skipReason: "ignored_extension" };
    }
  }

  if (config.filter) {
    try {
      if (config.filter(url, bot) === false) {
        return { shouldTrack: false, bot, classification, skipReason: "filtered_out" };
      }
    } catch {
      return { shouldTrack: false, bot, classification, skipReason: "filtered_out" };
    }
  }

  return { shouldTrack: true, bot, classification, url, eventId: newEventId() };
}
