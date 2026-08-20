/**
 * analytics-cookieless.js — Cookieless variant of the Convrs tracking script.
 *
 * No cookies are used for visitor identification. Session continuity uses
 * sessionStorage only (cleared when the tab/session ends). The visitor ID is
 * NOT generated client-side — it's a pseudonymous hash computed server-side
 * from IP + user-agent + hostname + a salt that rotates daily, returned in
 * the track response and cached for the rest of the tab session. This means
 * the same visitor is NOT linked across days, and cross-domain tracking is
 * not supported in this mode.
 *
 * ── Embed ─────────────────────────────────────────────────────────────────────
 *   <script src="/tracker.cookieless.js"
 *     data-website-id="YOUR_ID"
 *     data-domain="example.com"
 *     defer>
 *   </script>
 */
!(function () {
  "use strict";

  if (window.__analyticsLoaded) return;
  window.__analyticsLoaded = true;

  var _queue = [];
  if (window.analytics && window.analytics.q && Array.isArray(window.analytics.q)) {
    _queue = window.analytics.q.map(function (a) { return Array.from(a); });
  }

  var _script = document.currentScript;
  var attr = function (name) { return _script ? _script.getAttribute(name) : null; };
  var _src = (_script && _script.src) || "";

  function normalizeApiEndpoint(value) {
    if (value == null) return null;
    var v = String(value).trim();
    if (!v) return null;
    var lower = v.toLowerCase();
    if (lower === "undefined" || lower === "null" || lower === "false" || lower === "nan" ||
        lower === "/undefined" || lower.indexOf("undefined") === 0) return null;
    try { new URL(v, window.location.href); return v; } catch (_) { return null; }
  }

  var _defaultEndpoint = _src
    ? new URL("/api/track", _src).href
    : "http://localhost:3000/api/track";
  var _rawApi = attr("data-api");
  var _sanitizedApi = normalizeApiEndpoint(_rawApi);
  var _endpoint = _sanitizedApi || _defaultEndpoint;

  if (!_endpoint || _endpoint.includes("undefined")) {
    console.error("Invalid endpoint:", _endpoint);
    return;
  }

  var _websiteId = attr("data-website-id") || attr("data-token") || "";
  var _domain = attr("data-domain") || "";
  var _debug = attr("data-debug") === "true";
  var _disableConsole = attr("data-disable-console") === "true";
  var _allowLocal = attr("data-allow-localhost") === "true";
  var _allowFile = attr("data-allow-file-protocol") === "true";

  // Cross-domain tracking is not supported in cookieless mode — warn, don't
  // silently half-implement it.
  if (attr("data-allowed-hostnames")) {
    console.warn("[Analytics] data-allowed-hostnames is ignored in cookieless mode — cross-domain tracking requires persistent visitor identity.");
  }

  function log(level) {
    if (_disableConsole) return;
    if (level !== "error" && !_debug) return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift("[Analytics Cookieless]");
    console[level].apply(console, args);
  }

  var _enabled = true;
  var _disabledReason = "";
  function disable(reason) { _enabled = false; _disabledReason = reason; log("warn", "Disabled —", reason); }

  function isBot() {
    try {
      if (navigator.webdriver || window.callPhantom || window._phantom || window.__nightmare) return true;
      if (!navigator.userAgent || navigator.userAgent.length < 5) return true;
      var ua = navigator.userAgent.toLowerCase();
      var signals = ["headlesschrome", "phantomjs", "selenium", "webdriver", "puppeteer", "playwright",
        "python", "curl", "wget", "go-http", "node.js", "axios", "postman"];
      for (var i = 0; i < signals.length; i++) if (ua.indexOf(signals[i]) !== -1) return true;
      var domKeys = ["__webdriver_evaluate", "__selenium_evaluate", "_Selenium_IDE_Recorder",
        "__nightmare", "_phantom", "__fxdriver_evaluate"];
      for (var j = 0; j < domKeys.length; j++) if (window[domKeys[j]] !== undefined) return true;
      if (document.documentElement && (document.documentElement.getAttribute("webdriver") ||
          document.documentElement.getAttribute("selenium"))) return true;
    } catch (_) { return false; }
    return false;
  }

  function isLocalhost(hostname) {
    if (!hostname) return false;
    var h = hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" ||
      /^127(\.[0-9]+){0,3}$/.test(h) || h.endsWith(".local") || h.endsWith(".localhost");
  }

  if (isBot()) disable("bot detected");
  else if (window !== window.parent && !_debug) disable("inside iframe");
  else if (!_websiteId) disable("missing data-website-id");
  else if ("file:" === window.location.protocol && !_allowFile)
    disable("file:// protocol — add data-allow-file-protocol='true' to enable");
  else if (isLocalhost(window.location.hostname) && !_allowLocal)
    disable("localhost — add data-allow-localhost='true' to enable");

  function isOptedOut() {
    try {
      if (localStorage.getItem("convrs_ignore") === "true") return true;
    } catch (_) {}
    return navigator.doNotTrack === "1" || navigator.doNotTrack === "yes" ||
      navigator.globalPrivacyControl === true;
  }

  // ─── SESSION-ONLY STORAGE (no cookies, no localStorage for identity) ───────
  var SESSION_KEY = "_cv_sid";
  var ENTRY_KEY = "_cv_entry";
  var VISITOR_CACHE_KEY = "_cv_vid_cache"; // server-assigned, this tab only

  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getSessionId() {
    var sid = sessionGet(SESSION_KEY);
    if (!sid) { sid = uuid(); sessionSet(SESSION_KEY, sid); }
    return sid;
  }

  function getEntryPage() {
    var existing = sessionGet(ENTRY_KEY);
    if (existing) return existing;
    var page = window.location.pathname;
    sessionSet(ENTRY_KEY, page);
    return page;
  }

  // Placeholder only — overwritten by the server-computed hash after the
  // first successful send. Never persisted beyond this tab session.
  var _cachedVisitorId = sessionGet(VISITOR_CACHE_KEY) || uuid();

  function getVisitorId() { return _cachedVisitorId; }

  // ─── PAYLOAD ───────────────────────────────────────────────────────────────
  function buildBase() {
    var href = window.location.href;
    var hostname = window.location.hostname;
    return {
      websiteId: _websiteId,
      visitorId: getVisitorId(),
      timezone: (Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "") || "",
      domain: _domain || hostname,
      href: href,
      language: navigator.language || "",
      entrypage: getEntryPage(),
      referrer: document.referrer || null,
      screenWidth: screen.width || 0,
      screenHeight: screen.height || 0,
      viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0 },
      sessionId: getSessionId(),
      cookieless: true,
      // Fresh per-send ID so the server can dedupe a replayed/duplicated
      // delivery of this specific event.
      eventId: uuid(),
    };
  }

  function isInternalHost(hostname) {
    if (!hostname) return true;
    var h = hostname.toLowerCase();
    var current = window.location.hostname.toLowerCase();
    var root = (_domain || current).toLowerCase().replace(/^\./, "");
    return h === current || h === root || h.endsWith("." + root) || h.endsWith("." + current);
  }

  function isTrackableOutbound(url) {
    if (!url) return false;
    var lower = url.trim().toLowerCase();
    if (lower.indexOf("mailto:") === 0 || lower.indexOf("tel:") === 0 ||
        lower.indexOf("javascript:") === 0 || lower.indexOf("#") === 0) return false;
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      return !isInternalHost(parsed.hostname);
    } catch (_) { return false; }
  }

  function trackExitLink(url) {
    if (!_enabled || isOptedOut()) return;
    var payload = buildBase();
    payload.type = "exitlink";
    payload.exitlink = url;
    send(payload);
  }

  function sanitizeProps(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    var out = {}; var count = 0;
    for (var key in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (count >= 10) { log("warn", "Max 10 custom props — extra keys ignored"); break; }
      if (!/^[a-z0-9_-]{1,32}$/i.test(key)) continue;
      var val = String(raw[key] == null ? "" : raw[key]).slice(0, 255)
        .replace(/[<>'"&]/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "");
      out[key.toLowerCase()] = val;
      count++;
    }
    return out;
  }

  // ─── NETWORK — caches the server-returned visitorId on every response ─────
  function send(payload, callback) {
    var body = JSON.stringify(payload);
    log("info", "Sending " + payload.type, payload);

    // sendBeacon can't read the response body, and we NEED the response to
    // learn the server-computed visitorId — always use fetch/XHR here, never
    // sendBeacon, even though that means less guaranteed delivery on unload.
    try {
      fetch(_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        credentials: "omit",
      })
        .then(function (res) { return res.json().catch(function () { return null; }); })
        .then(function (json) {
          if (json && typeof json.visitorId === "string" && json.visitorId) {
            _cachedVisitorId = json.visitorId;
            sessionSet(VISITOR_CACHE_KEY, json.visitorId);
            window.analytics.visitorId = json.visitorId;
          }
          if (typeof callback === "function") callback({ status: 200 });
        })
        .catch(function () {
          if (typeof callback === "function") callback({ status: 0 });
        });
    } catch (_) {}
  }

  var _lastUrl = "";
  var _lastPageviewTime = 0;
  var PAGEVIEW_THROTTLE_MS = 60 * 1000;

  function trackPageview(callback) {
    if (!_enabled) { log("info", "trackPageview ignored —", _disabledReason); return; }
    if (isOptedOut()) { log("info", "trackPageview ignored — user opted out"); return; }
    var url = window.location.href;
    var now = Date.now();
    if (url === _lastUrl && now - _lastPageviewTime < PAGEVIEW_THROTTLE_MS) return;
    _lastUrl = url; _lastPageviewTime = now;
    var payload = buildBase();
    payload.type = "pageview";
    send(payload, callback);
  }

  function trackEvent(eventName, props, callback) {
    if (!_enabled) { log("info", "trackEvent ignored —", _disabledReason); return; }
    if (isOptedOut()) return;
    if (!eventName || typeof eventName !== "string") return;
    var payload = buildBase();
    payload.type = "custom";
    payload.extraData = Object.assign({ eventName: eventName }, sanitizeProps(props));
    send(payload, callback);
  }

  // NOTE: identify() is deliberately NOT exposed in cookieless mode — there is
  // no stable long-lived visitor to attach identity traits to across days,
  // matching the documented limitation ("Identify ... not applied in the
  // same way for cookieless sites").
  function identify() {
    log("warn", "identify() is not supported in cookieless mode");
  }

  // ─── SPA ROUTE TRACKING ────────────────────────────────────────────────────
  var _pendingPageview = null;
  var _lastPathname = window.location.pathname;
  function schedulePageview() {
    if (_pendingPageview) clearTimeout(_pendingPageview);
    _pendingPageview = setTimeout(function () { _pendingPageview = null; trackPageview(); }, 100);
  }
  var _origPush = window.history.pushState;
  var _origReplace = window.history.replaceState;
  window.history.pushState = function () {
    _origPush.apply(this, arguments);
    if (window.location.pathname !== _lastPathname) { _lastPathname = window.location.pathname; schedulePageview(); }
  };
  window.history.replaceState = function () {
    _origReplace.apply(this, arguments);
    if (window.location.pathname !== _lastPathname) { _lastPathname = window.location.pathname; schedulePageview(); }
  };
  window.addEventListener("popstate", function () {
    if (window.location.pathname !== _lastPathname) { _lastPathname = window.location.pathname; schedulePageview(); }
  });

  // ─── DECLARATIVE GOALS ──────────────────────────────────────────────────────
  function fireGoal(el) {
    var goalName = el.getAttribute("data-goal");
    if (!goalName || !goalName.trim()) return;
    var props = {};
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.name !== "data-goal" && a.name.indexOf("data-goal-") === 0) {
        var key = a.name.slice(10);
        if (key) props[key.replace(/-/g, "_")] = a.value;
      }
    }
    trackEvent(goalName.trim(), props);
  }

  function onActivation(e) {
    var goalEl = e.target && e.target.closest("[data-goal]");
    if (goalEl) fireGoal(goalEl);
    var anchor = e.target && e.target.closest("a[href]");
    if (anchor) {
      var href = anchor.getAttribute("href");
      if (isTrackableOutbound(href)) {
        try { trackExitLink(new URL(href, window.location.href).href); } catch (_) {}
      }
    }
  }
  document.addEventListener("click", onActivation, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") onActivation(e);
  }, true);

  function drainQueue() {
    while (_queue.length > 0) {
      var call = _queue.shift();
      if (!Array.isArray(call) || !call.length) continue;
      var fn = call[0]; var args = call.slice(1);
      try {
        if (fn === "trackPageview") trackPageview.apply(null, args);
        else if (fn === "trackEvent") trackEvent.apply(null, args);
        else if (fn === "identify") identify();
      } catch (err) { log("error", "Error draining queue:", err); }
    }
  }

  function init() {
    trackPageview();
    drainQueue();
    startHeartbeat();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // ─── LIVE HEARTBEAT ────────────────────────────────────────────────────────
  var _heartbeatInterval = null;
  var _liveEndpoint = _src
    ? new URL("/api/live/heartbeat", _src).href
    : "http://localhost:3000/api/live/heartbeat";

  function sendHeartbeat() {
    if (!_enabled || isOptedOut() || document.hidden) return;
    var body = JSON.stringify({
      workspaceId: _websiteId,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      page: window.location.pathname,
      url: window.location.href,
      cookieless: true,
    });
    try {
      fetch(_liveEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: body, keepalive: true, credentials: "omit",
      }).catch(function () {});
    } catch (_) {}
  }

  function startHeartbeat() {
    if (!_enabled || isOptedOut()) return;
    sendHeartbeat();
    _heartbeatInterval = setInterval(sendHeartbeat, 10000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) sendHeartbeat(); });
    window.addEventListener("beforeunload", function () { if (_heartbeatInterval) clearInterval(_heartbeatInterval); });
  }

  window.analytics = { trackPageview: trackPageview, trackEvent: trackEvent, identify: identify };

  function convrs(eventName, props) {
    if (!eventName || typeof eventName !== "string") return;
    if (eventName === "pageview") { trackPageview(); return; }
    if (eventName === "identify") { identify(); return; }
    trackEvent(eventName, props);
  }

  if (window.convrs && window.convrs.q && Array.isArray(window.convrs.q)) {
    var _convrsQueue = window.convrs.q.slice();
    window.convrs = convrs;
    for (var _i = 0; _i < _convrsQueue.length; _i++) {
      var _call = _convrsQueue[_i];
      if (Array.isArray(_call) && _call.length) { try { convrs.apply(null, _call); } catch (_) {} }
    }
  } else {
    window.convrs = convrs;
  }
})();