
import { createCookielessWebStorageAdapter, createHybridStorageAdapter, createLocalStorageAdapter, createMemoryStorageAdapter } from "./storage";
import { createFetchNetworkAdapter } from "./network";
import { getDeviceInfo } from "./device";
import { setCookie, } from "./cookies";
import { onViewportChange } from "./device";
import { isLikelyBot, isInIframe, isLocalhostHostname, isFileProtocol } from "./bot";
import { createConvrsClient, getConvrsClient } from "./client";
import { createNoopClient } from "./noop";
import { startHeartbeat } from "./heartbeat";
import { ConvrsWebConfig } from "./types";

// src/web/index.ts
let teardownAutoPageviewCapture: (() => void) | null = null;
let teardownHeartbeat: (() => void) | null = null;
function resolveAutoCapturePageviewsConfig(option: any) {
  if (!option) {
    return {
      enabled: false,
      trackHashChanges: false,
      captureInitialPageview: true,
      debounceMs: 100
    };
  }
  if (option === true) {
    return {
      enabled: true,
      trackHashChanges: false,
      captureInitialPageview: true,
      debounceMs: 100
    };
  }
  return {
    enabled: option.enabled ?? true,
    trackHashChanges: option.trackHashChanges ?? false,
    captureInitialPageview: option.captureInitialPageview ?? true,
    debounceMs: option.debounceMs ?? 100
  };
}
function getCurrentPagePath(trackHashChanges: boolean) {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${trackHashChanges ? hash : ""}`;
}
function setupAutoPageviewCapture(client: any, config: any) {
  if (typeof window === "undefined") return;
  if (teardownAutoPageviewCapture) {
    teardownAutoPageviewCapture();
  }
  let lastPath = getCurrentPagePath(config.trackHashChanges);
  let trackingTimeout: any = null;
  const trackIfChanged = () => {
    const nextPath = getCurrentPagePath(config.trackHashChanges);
    if (nextPath === lastPath) return;
    lastPath = nextPath;
    void client.trackPageview();
  };
  const scheduleTracking = () => {
    if (trackingTimeout) clearTimeout(trackingTimeout);
    trackingTimeout = setTimeout(trackIfChanged, config.debounceMs);
  };
  if (config.captureInitialPageview) {
    void client.trackPageview();
  }
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  window.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    scheduleTracking();
  };
  window.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    scheduleTracking();
  };
  window.addEventListener("popstate", scheduleTracking);
  if (config.trackHashChanges) {
    window.addEventListener("hashchange", scheduleTracking);
  }
  teardownAutoPageviewCapture = () => {
    if (trackingTimeout) clearTimeout(trackingTimeout);
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", scheduleTracking);
    if (config.trackHashChanges) {
      window.removeEventListener("hashchange", scheduleTracking);
    }
    teardownAutoPageviewCapture = null;
  };
}
function readCrossDomainParams() {
  try {
    const url = new URL(window.location.href);
    return {
      vid: url.searchParams.get("_cv_vid"),
      sid: url.searchParams.get("_cv_sid"),
      start: url.searchParams.get("_cv_start"), // ← original session start timestamp
    };
  } catch {
    return { vid: null, sid: null, start: null };
  }
}

function cleanCrossDomainParams() {
  try {
    const url = new URL(window.location.href);
    if (
      url.searchParams.has("_cv_vid") ||
      url.searchParams.has("_cv_sid") ||
      url.searchParams.has("_cv_start")
    ) {
      url.searchParams.delete("_cv_vid");
      url.searchParams.delete("_cv_sid");
      url.searchParams.delete("_cv_start");
      window.history.replaceState({}, "", url.toString());
    }
  } catch { }
}

function resolveLiveHeartbeatEndpoint() {
  if (typeof window === "undefined") {
    return "http://localhost:3000/api/live/heartbeat";
  }

  return "https://app.convrs.dev/api/live/heartbeat";
}

// ── Outbound link helpers ─────────────────────────────────────────────────

function isInternalUrl(url: string, domain: string, allowedHostnames: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const root = domain.split(":")[0].toLowerCase().replace(/^www\./, "");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true; // mailto:, tel:, javascript: — not outbound links
    }
    if (
      host === root ||
      host.endsWith("." + root) ||
      host === window.location.hostname.toLowerCase()
    ) {
      return true;
    }
    // CROSS-DOMAIN TRACKING: an explicitly allowed hostname is treated as
    // internal so it's never fired as an exit link.
    return allowedHostnames.includes(host);
  } catch {
    return true;
  }
}

function isTrackableOutboundHref(
  href: string | null,
  domain: string,
  allowedHostnames: string[] = []
): boolean {
  if (!href) return false;
  const lower = href.trim().toLowerCase();
  if (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("#")
  ) return false;
  return !isInternalUrl(href, domain, allowedHostnames);
}

function isAllowedCrossDomainHost(hostname: string, allowedHostnames: string[]): boolean {
  const h = hostname.toLowerCase();
  const current = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (h === current) return false;
  return allowedHostnames.includes(h);
}



function setupOutboundLinkTracking(client: any, domain: string, allowedHostnames: string[] = []) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const handleActivation = (e: MouseEvent | KeyboardEvent) => {
    if (e.type === "keydown") {
      const ke = e as KeyboardEvent;
      if (ke.key !== "Enter" && ke.key !== " ") return;
    }

    const target = e.target as Element | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // CROSS-DOMAIN TRACKING: rewrite href in place, before default navigation
    // runs (capture phase), so visitor/session identity carries to the target
    // domain. Only applies to explicitly allowed hostnames.
    try {
      const resolved = new URL(href, window.location.href);
      if (isAllowedCrossDomainHost(resolved.hostname, allowedHostnames)) {
        const rewritten = client.buildCrossDomainUrl(resolved.href);
        if (rewritten && rewritten !== resolved.href) {
          anchor.setAttribute("href", rewritten);
        }
        return; // allowed cross-domain destination — not an exit link
      }
    } catch {
      // fall through to normal outbound handling if URL parsing fails
    }

    if (!isTrackableOutboundHref(href, domain, allowedHostnames)) return;

    try {
      const absoluteUrl = new URL(href, window.location.href).href;
      void client.trackExitLink(absoluteUrl);
    } catch { }
  };

  document.addEventListener("click", handleActivation, true);
  document.addEventListener("keydown", handleActivation, true);

  return () => {
    document.removeEventListener("click", handleActivation, true);
    document.removeEventListener("keydown", handleActivation, true);
  };
}

async function initConvrs(config: ConvrsWebConfig ) {
   const debug = config.debug ?? false;
  if (isLikelyBot()) return createNoopClient("bot detected", debug);
  if (isInIframe() && !config.allowIframe) return createNoopClient("inside an iframe", debug);
  if (
    (isLocalhostHostname(typeof window !== "undefined" ? window.location.hostname : "") || isFileProtocol()) &&
    !config.allowLocalhost
  ) return createNoopClient("localhost or file:// protocol", debug);

  const domain = config.domain ?? (typeof window !== "undefined" ? window.location.host : "unknown");
  const cookieDomain = domain.split(":")[0];
  const cookieless = config.cookieless ?? false;
  const SESSION_TTL_DAYS = 2 / 24;

  // ── CROSS-DOMAIN TRACKING: allowlist ──────────────────────────────────────
  const allowedHostnames: string[] = Array.isArray(config.allowedHostnames)
    ? config.allowedHostnames
        .map((h: string) => (typeof h === "string" ? h.trim().toLowerCase() : ""))
        .filter(Boolean)
    : [];

  // ── Restore cross-domain session BEFORE storage/init ─────────────────────
  const crossDomain = readCrossDomainParams();
  const hasCrossDomainParams = !!(crossDomain.vid || crossDomain.sid);

  if (hasCrossDomainParams && !cookieless) {
    if (crossDomain.vid) {
      setCookie("_cv_vid", crossDomain.vid, 365, cookieDomain);
    }
    if (crossDomain.sid) {
      setCookie("_cv_sid", crossDomain.sid, SESSION_TTL_DAYS, cookieDomain);
      setCookie("_cv_start", crossDomain.start ?? Date.now().toString(), SESSION_TTL_DAYS, cookieDomain);
    }
    cleanCrossDomainParams();
  }

  // ── Storage adapter — created AFTER cookie restore ────────────────────────
  let storage;
  try {
    localStorage.setItem("__convrs_test__", "test");
    localStorage.removeItem("__convrs_test__");
    storage = cookieless ? createCookielessWebStorageAdapter(cookieDomain) : createHybridStorageAdapter(cookieDomain);
  } catch {
    console.warn("[Convrs] localStorage not available, using in-memory storage");
    storage = createMemoryStorageAdapter();
  }

  const network = createFetchNetworkAdapter();
  const deviceInfo = getDeviceInfo();

  // Use fresh client when cross-domain params present so initSessionId()
  // runs fresh and reads the restored cookies instead of cached in-memory state
  const client = hasCrossDomainParams
    ? createConvrsClient()
    : getConvrsClient();

  await client.init({
    appId: config.websiteId,
    domain,
    storage,
    network,
    platform: "web",
    apiUrl: config.apiUrl,
    debug,
    flushInterval: config.flushInterval ?? 5000,
    maxQueueSize: config.maxQueueSize ?? 10,
    cookieless,
    onCookielessVisitorId:
      config.onCookielessVisitorId ??
      (cookieless
        ? (vid: string) => {
          try {
            const w = window as any;
            w.convrs = w.convrs ?? {};
            if (vid) w.convrs.visitorId = vid;
            else delete w.convrs.visitorId;
          } catch { }
        }
        : undefined),
  });

  client.setDeviceInfo(deviceInfo); // ← called ONCE

  onViewportChange((viewport) => {
    client.setDeviceInfo({ ...deviceInfo, viewport });
  });

  // ── Rolling session refresh ───────────────────────────────────────────────
  if (!cookieless) {
    const rollSession = () => {
      const sid = client.getSessionId();
      if (!sid) return;
      const now = Date.now();
      setCookie("_cv_sid", sid, SESSION_TTL_DAYS, cookieDomain); // 2h not 30min
      setCookie("_cv_start", now.toString(), SESSION_TTL_DAYS, cookieDomain);
    };
    ["click", "keydown", "scroll", "touchstart"].forEach((evt) =>
      window.addEventListener(evt, rollSession, { passive: true })
    );
  }

  const webClient: any = client;

let teardownOutboundTracking: (() => void) | null = null;

  if (!cookieless) {
    teardownOutboundTracking = setupOutboundLinkTracking(webClient, domain, allowedHostnames) ?? null;
  }
  
  webClient.trackPageview = async (path?: string) => {
    if (path) {
      await client.trackScreen(path);
    } else {
      const href = typeof window !== "undefined" ? window.location.href : undefined;
      const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
      await client.trackScreen(pagePath, { href });
    }
  };

 webClient.getTrackingParams = (): { _cv_vid: string; _cv_sid: string } => {
    if (client.isCookieless()) return { _cv_vid: "", _cv_sid: "" };
    return {
      _cv_vid: client.getVisitorId() ?? "",
      _cv_sid: client.getSessionId() ?? "",
    };
  };

webClient.buildCrossDomainUrl = (url: string): string => {
    if (client.isCookieless()) return url;
    try {
      const urlObj = new URL(url);
      if (!isAllowedCrossDomainHost(urlObj.hostname, allowedHostnames)) {
        if (debug) {
          console.warn(
            "[Convrs] buildCrossDomainUrl: hostname not in allowedHostnames, returning unchanged —",
            urlObj.hostname
          );
        }
        return url;
      }
      const vid = client.getVisitorId();
      const sid = client.getSessionId();
      if (vid) urlObj.searchParams.set("_cv_vid", vid);
      if (sid) urlObj.searchParams.set("_cv_sid", sid);
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  const autoCaptureConfig = resolveAutoCapturePageviewsConfig(config.autoCapturePageviews);
  if (autoCaptureConfig.enabled) {
    setupAutoPageviewCapture(webClient, autoCaptureConfig);
  } else if (teardownAutoPageviewCapture) {
    teardownAutoPageviewCapture();
  }

  if (teardownHeartbeat) {
    teardownHeartbeat();
  }

  const liveEndpoint = resolveLiveHeartbeatEndpoint();
  teardownHeartbeat = startHeartbeat({
    endpoint: liveEndpoint,
    websiteId: config.websiteId,
    getVisitorId: () => client.getVisitorId(),
    getSessionId: () => client.getSessionId(),
    enabled: () => client.isInitialized(),
  });

  // Add to shutdown
  const originalShutdown = client.shutdown?.bind(client);
  client.shutdown = async () => {
    teardownOutboundTracking?.();
    if (teardownHeartbeat) { teardownHeartbeat(); teardownHeartbeat = null; }
    if (teardownAutoPageviewCapture) teardownAutoPageviewCapture();
    if (originalShutdown) await originalShutdown();
  };

  const originalOptOut = webClient.optOut?.bind(client);
  webClient.optOut = async () => {
    if (teardownHeartbeat) {
      teardownHeartbeat();
      teardownHeartbeat = null;
    }
    if (teardownAutoPageviewCapture) {
      teardownAutoPageviewCapture();
    }
    if (originalOptOut) {
      await originalOptOut();
    }
  };

  return webClient;
}

async function createConvrsWithAdapters(config: any) {
  const client = createConvrsClient();
  await client.init(config);
  const deviceInfo = getDeviceInfo();
  client.setDeviceInfo(deviceInfo);
  return client;
}
async function createConvrsWeb(config: any) {
  return initConvrs(config);
}
var convrsWeb = {
  init: initConvrs,
  createWeb: createConvrsWeb,
  getClient: getConvrsClient,
  createClient: createConvrsClient
};
var web_default = convrsWeb;

export * from "./client";
export * from "./queue";
export * from "./utils";
export * from "./storage";
export * from "./device";
export * from "./cookies";
export * from "./bot";
export * from "./noop";
export * from "./network";
export * from "./heartbeat";

export { initConvrs };