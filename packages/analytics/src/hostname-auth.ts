/**
 * Which hostnames a project token may report events for.
 *
 * A project token is public (it ships in every page's HTML), so it is not a
 * credential: anyone can copy it onto another site. What binds events to the
 * workspace's own site is that the event's hostname — always taken from the
 * page URL, never from the tracker's `data-domain` hint — must be the
 * workspace domain (or a subdomain of it), an entry in `allowedHostnames`,
 * or anything when `allowAllDomains` is on. For browser requests the
 * `Origin` header (which page script cannot forge) must match that URL too.
 */

export interface HostnamePolicy {
  domain: string | null;
  allowedHostnames: string[];
  allowAllDomains: boolean;
}

type Env = Record<string, string | undefined>;

const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)*$/;

/** Lowercased bare hostname from a hostname, host:port or URL; null if invalid. */
export function normalizeHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  } else {
    value = value.split(/[/?#]/)[0]!;
    if (value.startsWith("[")) return null; // IPv6 literals are never a site domain
    value = value.replace(/:\d+$/, "");
  }
  value = value.replace(/\.$/, "");
  return HOSTNAME_RE.test(value) ? value : null;
}

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function isLocalHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/**
 * Local development hostnames are accepted when explicitly enabled, or when
 * the service is clearly not running in production.
 */
export function localhostTrackingAllowed(env: Env = process.env): boolean {
  if (env.TRACKING_ALLOW_LOCALHOST === "true") return true;
  if (env.TRACKING_ALLOW_LOCALHOST === "false") return false;
  return env.NODE_ENV !== "production" && env.RENDER !== "true";
}

export function isHostnameAuthorized(
  rawHost: string | null | undefined,
  policy: HostnamePolicy,
  options: { allowLocalhost?: boolean } = {}
): boolean {
  const host = normalizeHostname(rawHost);
  if (!host) return false;
  if (policy.allowAllDomains) return true;
  if (isLocalHostname(host)) return options.allowLocalhost === true;

  const domain = normalizeHostname(policy.domain);
  if (domain) {
    const root = stripWww(domain);
    if (host === domain || host === root || host.endsWith(`.${root}`)) return true;
  }

  return policy.allowedHostnames.some((entry) => {
    const wildcard = entry.trim().startsWith("*.");
    const allowed = normalizeHostname(wildcard ? entry.trim().slice(2) : entry);
    if (!allowed) return false;
    if (host === allowed) return true;
    return wildcard && host.endsWith(`.${allowed}`);
  });
}

export type EventHostResult =
  | { ok: true; hostname: string }
  | { ok: false; reason: "invalid_url" | "origin_mismatch" };

/**
 * The event's hostname is the page URL's hostname. When the request carries
 * a browser `Origin`, it must name the same host — otherwise a page on one
 * site is reporting a URL from another.
 */
export function resolveEventHostname(
  pageUrl: string | null | undefined,
  originHeader: string | null | undefined
): EventHostResult {
  let hostname: string | null = null;
  try {
    const url = new URL(pageUrl ?? "");
    if (url.protocol === "http:" || url.protocol === "https:") {
      hostname = normalizeHostname(url.hostname);
    }
  } catch {}
  if (!hostname) return { ok: false, reason: "invalid_url" };

  if (originHeader && originHeader !== "null") {
    const originHost = normalizeHostname(originHeader);
    if (originHost !== hostname) return { ok: false, reason: "origin_mismatch" };
  }

  return { ok: true, hostname };
}
