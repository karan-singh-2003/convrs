import {
  AGENTS,
  CLASSIFIER_VERSION,
  FALLBACK_VENDOR_HINTS,
  GENERIC_BOT_PATTERNS,
  GENERIC_PATTERN_EXCEPTIONS,
} from "./registry";
import { BOT_CATEGORY, type AgentDefinition, type BotClassification, type BotMatch } from "./types";

// Longest tokens first so the most specific agent wins when several appear.
const AGENTS_BY_SPECIFICITY: AgentDefinition[] = [...AGENTS].sort(
  (a, b) => b.token.length - a.token.length
);

const ALNUM = /[a-z0-9]/;

/**
 * True when `token` occurs in `ua` as a whole product token — not glued to
 * other letters/digits on either side. "GPTBot/1.1" and "Googlebot-Image"
 * match their tokens; "MyGrokPoweredApp" does not match "grok".
 */
function containsToken(ua: string, token: string): boolean {
  let from = 0;
  while (from <= ua.length - token.length) {
    const index = ua.indexOf(token, from);
    if (index === -1) return false;
    const before = index === 0 ? "" : ua[index - 1]!;
    const after = ua[index + token.length] ?? "";
    if (!ALNUM.test(before) && !ALNUM.test(after)) return true;
    from = index + 1;
  }
  return false;
}

const AUTOMATION_CONTEXT =
  /(bot|crawl|spider|slurp|scrap|fetch|preview|archiv|monitor|checker|\+https?:\/\/)/i;

/**
 * Whether a UA carries explicit automation wording. A vendor-name hint alone
 * ("claude", "google", "copilot") is never enough to call something a
 * crawler: desktop apps, browser extensions and in-app browsers routinely
 * mention vendors. It also needs crawler wording or a "+http(s)://" contact
 * URL (the convention crawlers use to identify their operator).
 */
export function hasAutomationContext(userAgent: string): boolean {
  return AUTOMATION_CONTEXT.test(userAgent);
}

function fromAgent(agent: AgentDefinition): BotClassification {
  return {
    vendor: agent.vendor,
    agentName: agent.token,
    category: agent.category,
    matchType: "exact",
    name: agent.name,
    purpose: agent.purpose,
    verification: agent.verification,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

/**
 * Full classification, in order of specificity:
 *   1. exact known crawler product token (AGENTS)
 *   2. constrained vendor fallback (hint + automation context)
 *   3. generic automation pattern → category "other", agent "unknown_bot"
 *   4. null → treat as a human browser
 */
export function classifyUserAgent(userAgent: string | null | undefined): BotClassification | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  const exact = AGENTS_BY_SPECIFICITY.find((agent) => containsToken(ua, agent.token));
  if (exact) return fromAgent(exact);

  if (hasAutomationContext(ua)) {
    const fallback = FALLBACK_VENDOR_HINTS.find((entry) =>
      entry.hints.some((hint) => ua.includes(hint))
    );
    if (fallback) {
      return {
        vendor: fallback.vendor,
        agentName: fallback.vendor,
        category: fallback.category,
        matchType: "fallback",
        name: `${fallback.vendor} (unrecognised agent)`,
        purpose: "Unrecognised agent from a known vendor",
        verification: { method: "none" },
        classifierVersion: CLASSIFIER_VERSION,
      };
    }
  }

  const genericUa = GENERIC_PATTERN_EXCEPTIONS.reduce((acc, re) => acc.replace(re, " "), ua);
  if (GENERIC_BOT_PATTERNS.some((pattern) => genericUa.includes(pattern))) {
    return {
      vendor: "Unknown",
      agentName: "unknown_bot",
      category: BOT_CATEGORY.OTHER,
      matchType: "generic",
      name: "Unknown bot",
      purpose: "Automated client not in the known-crawler registry",
      verification: { method: "none" },
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  return null;
}

/**
 * 1.0.x-compatible classifier: same shape as before ({ vendor, agentName,
 * category }). Since 1.1.0 generic automated clients are no longer dropped —
 * they come back as { vendor: "Unknown", agentName: "unknown_bot",
 * category: "other" }.
 */
export function classifyBotUserAgent(userAgent: string | null | undefined): BotMatch | null {
  const result = classifyUserAgent(userAgent);
  if (!result) return null;
  return { vendor: result.vendor, agentName: result.agentName, category: result.category };
}

/** Look up a registry entry by its token (e.g. a stored `agent_name`). */
export function getAgentByToken(token: string | null | undefined): AgentDefinition | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  return AGENTS.find((agent) => agent.token === normalized);
}
