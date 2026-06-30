/**
 * analytics.js — Production-ready single-file analytics SDK
 *
 * ── Embed ─────────────────────────────────────────────────────────────────────
 *   <script src="/tracker.js"
 *     data-website-id="YOUR_ID"
 *     data-domain="example.com"
 *     defer>
 *   </script>
 *
 * ── Optional attributes ───────────────────────────────────────────────────────
 *   data-api="https://your-server.com/api/track"   Override collector endpoint
 *   data-debug="true"                              Log all events to console
 *   data-allow-localhost="true"                    Enable tracking on localhost
 *   data-allow-file-protocol="true"               Enable tracking on file://
 *
 * ── Pre-init queue (place before script tag) ──────────────────────────────────
 *   window.analytics = window.analytics || { q: [] };
 *   window.analytics.q.push(["trackEvent", "signup", { plan: "pro" }]);
 *
 * ── Public API (after load) ───────────────────────────────────────────────────
 *   window.analytics.trackEvent("purchase", { plan: "pro", amount: 49.99 })
 *   window.analytics.trackPageview()
 *   window.analytics.identify({ user_id: "u_123", name: "Jane" })
 *
 * ── Declarative HTML API ──────────────────────────────────────────────────────
 *   <button data-goal="signup" data-goal-plan="pro">Sign up</button>
 *   <section data-scroll-goal="section_viewed" data-scroll-threshold="0.5"></section>
 */
!(function () {
  "use strict";

  // ─── GUARD ─────────────────────────────────────────────────────────────────
  if (window.__analyticsLoaded) return;
  window.__analyticsLoaded = true;

  // ─── PRE-INIT QUEUE ────────────────────────────────────────────────────────
  // Drain any calls made before the script loaded
  var _queue = [];
  if (
    window.analytics &&
    window.analytics.q &&
    Array.isArray(window.analytics.q)
  ) {
    _queue = window.analytics.q.map(function (a) {
      return Array.from(a);
    });
  }

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  var _script = document.currentScript;
  var attr = function (name) {
    return _script ? _script.getAttribute(name) : null;
  };

  // Get script src safely
  var _src = (_script && _script.src) || "";
  // var isCDN = _src.includes("cdn.karanbuilds.me");

  function normalizeApiEndpoint(value) {
    if (value == null) return null;

    var v = String(value).trim();
    if (!v) return null;

    var lower = v.toLowerCase();
    if (
      lower === "undefined" ||
      lower === "null" ||
      lower === "false" ||
      lower === "nan" ||
      lower === "/undefined" ||
      lower.indexOf("undefined") === 0
    ) {
      return null;
    }

    try {
      // Validate URL shape (absolute or relative) to avoid fetch('/undefined').
      new URL(v, window.location.href);
      return v;
    } catch (_) {
      return null;
    }
  }

  // var _defaultEndpoint = isCDN
  //   ? "http://ingest.convrs.dev/api/track"
  //   : new URL("/api/track", window.location.origin).href;
  var _defaultEndpoint = _src
    ? new URL("/api/track", _src).href
    : "http://localhost:3000/api/track";
  var _rawApi = attr("data-api");
  var _sanitizedApi = normalizeApiEndpoint(_rawApi);
  var _invalidApiValue = _rawApi && !_sanitizedApi ? _rawApi : null;
  var _endpoint = _sanitizedApi || _defaultEndpoint;

  if (!_endpoint || _endpoint.includes("undefined")) {
    console.error("Invalid endpoint:", _endpoint);
    return;
  }

  var _websiteId = attr("data-website-id") || attr("data-token") || "";
  var _domain = attr("data-domain") || "";
  var _debug = attr("data-debug") === "true";
  var _allowLocal = attr("data-allow-localhost") === "true";
  var _allowFile = attr("data-allow-file-protocol") === "true";

  // ─── LOGGING ───────────────────────────────────────────────────────────────
  function log(level) {
    if (!_debug) return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift("[Analytics]");
    console[level].apply(console, args);
  }

  if (_invalidApiValue) {
    log("warn", "Ignoring invalid data-api value:", _invalidApiValue);
  }

  // ─── ENABLED STATE ─────────────────────────────────────────────────────────
  var _enabled = true;
  var _disabledReason = "";

  function disable(reason) {
    _enabled = false;
    _disabledReason = reason;
    log("warn", "Disabled —", reason);
  }

  // ─── BOT DETECTION ─────────────────────────────────────────────────────────
  function isBot() {
    try {
      if (navigator.webdriver || window.callPhantom || window._phantom)
        return true;
      var ua = (navigator.userAgent || "").toLowerCase();
      var signals = [
        "headlesschrome",
        "phantomjs",
        "selenium",
        "webdriver",
        "puppeteer",
        "playwright",
        "python",
        "curl",
        "wget",
        "go-http",
        "node.js",
        "axios",
        "postman",
      ];
      for (var i = 0; i < signals.length; i++) {
        if (ua.indexOf(signals[i]) !== -1) return true;
      }
      var domKeys = [
        "__webdriver_evaluate",
        "__selenium_evaluate",
        "_Selenium_IDE_Recorder",
        "__nightmare",
        "_phantom",
        "__fxdriver_evaluate",
      ];
      for (var j = 0; j < domKeys.length; j++) {
        if (window[domKeys[j]] !== undefined) return true;
      }
      if (
        document.documentElement &&
        (document.documentElement.getAttribute("webdriver") ||
          document.documentElement.getAttribute("selenium"))
      )
        return true;
    } catch (_) {
      return false;
    }
    return false;
  }

  function isLocalhost(hostname) {
    if (!hostname) return false;
    var h = hostname.toLowerCase();
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "::1" ||
      /^127(\.[0-9]+){0,3}$/.test(h) ||
      h.endsWith(".local") ||
      h.endsWith(".localhost")
    );
  }

  // Run all startup checks
  if (isBot()) disable("bot detected");
  else if (window !== window.parent && !_debug) disable("inside iframe");
  else if (!_websiteId) disable("missing data-website-id");
  else if ("file:" === window.location.protocol && !_allowFile)
    disable("file:// protocol — add data-allow-file-protocol='true' to enable");
  else if (isLocalhost(window.location.hostname) && !_allowLocal)
    disable("localhost — add data-allow-localhost='true' to enable");

  // DNT / GPC checked per-event so user can change it mid-session
  function isOptedOut() {
    return (
      navigator.doNotTrack === "1" ||
      navigator.doNotTrack === "yes" ||
      navigator.globalPrivacyControl === true
    );
  }

  // ─── COOKIES ───────────────────────────────────────────────────────────────
  var SESSION_KEY = "_atk_sid";
  var VISITOR_KEY = "_atk_vid";
  var SESSION_SECS = 30 * 60; // 30 min sliding
  var VISITOR_SECS = 365 * 24 * 3600; // 1 year
  var ENTRY_KEY = "_atk_entry";

  function getEntryPage() {
    var existing = getCookie(ENTRY_KEY);
    if (existing) return existing;
    var page = window.location.pathname;
    setCookie(ENTRY_KEY, page, SESSION_SECS);
    return page;
  }

  function getCookie(name) {
    var match = document.cookie.match(
      new RegExp("(?:^|; )" + name + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, maxAgeSec) {
    var cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; max-age=" +
      maxAgeSec +
      "; path=/" +
      "; SameSite=Lax"; // Lax so cookie survives navigations from external links
    if (_domain && !isLocalhost(window.location.hostname)) {
      cookie += "; domain=." + _domain.replace(/^\./, "");
    }
    document.cookie = cookie;
  }

  // ─── SESSION & VISITOR IDS ─────────────────────────────────────────────────
  function uuid() {
    // Use crypto.randomUUID when available, fall back to Math.random
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  }

  function getSessionId() {
    var sid = getCookie(SESSION_KEY);
    if (!sid) sid = uuid();
    setCookie(SESSION_KEY, sid, SESSION_SECS); // slide expiry on every event
    return sid;
  }

  function getVisitorId() {
    // Cookie is source of truth; localStorage provides cross-cookie-clear persistence
    var vid = getCookie(VISITOR_KEY);
    if (vid) return vid;

    try {
      vid = localStorage.getItem(VISITOR_KEY);
    } catch (_) {
      vid = null;
    }
    if (!vid) vid = uuid();

    try {
      localStorage.setItem(VISITOR_KEY, vid);
    } catch (_) { }
    setCookie(VISITOR_KEY, vid, VISITOR_SECS);
    return vid;
  }

  // ─── PAYLOAD ───────────────────────────────────────────────────────────────
  function buildBase() {
    var href = window.location.href;
    var hostname = window.location.hostname;
    var referrer = document.referrer || null;
    var language = navigator.language || "";
    var timezone =
      (Intl && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "") || "";
    var screenWidth = screen.width || 0;
    var screenHeight = screen.height || 0;
    var viewportWidth = window.innerWidth || 0;
    var viewportHeight = window.innerHeight || 0;
    var sessionId = getSessionId();
    var visitorId = getVisitorId();

    return {
      // Camel-case payload (requested format)
      websiteId: _websiteId,
      visitorId: visitorId,
      timezone: timezone,
      domain: _domain || hostname,
      href: href,
      language: language,
      entrypage: getEntryPage(),
      referrer: referrer,
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      sessionId: sessionId,
    };
  }

  function isInternalHost(hostname) {
    if (!hostname) return true;
    var h = hostname.toLowerCase();
    var current = window.location.hostname.toLowerCase();
    var root = (_domain || current).toLowerCase().replace(/^\./, "");
    return (
      h === current ||
      h === root ||
      h.endsWith("." + root) ||
      h.endsWith("." + current)
    );
  }

  function isTrackableOutbound(url) {
    if (!url) return false;
    var lower = url.trim().toLowerCase();
    if (
      lower.indexOf("mailto:") === 0 ||
      lower.indexOf("tel:") === 0 ||
      lower.indexOf("javascript:") === 0 ||
      lower.indexOf("#") === 0
    ) {
      return false;
    }
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      return !isInternalHost(parsed.hostname);
    } catch (_) {
      return false;
    }
  }

  function trackExitLink(url, callback) {
    if (!_enabled || isOptedOut()) return;
    var payload = buildBase();
    payload.type = "exitlink";
    payload.exitlink = url;
    send(payload);
    if (typeof callback === "function") callback({ status: 200 });
  }

  // ─── PROPS VALIDATION ──────────────────────────────────────────────────────
  // Max 10 props, keys alphanumeric/underscore/hyphen ≤32 chars,
  // values coerced to string ≤255 chars with basic XSS chars stripped.
  function sanitizeProps(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    var out = {};
    var count = 0;
    for (var key in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (count >= 10) {
        log("warn", "Max 10 custom props — extra keys ignored");
        break;
      }
      if (!/^[a-z0-9_-]{1,32}$/i.test(key)) {
        log(
          "warn",
          'Invalid prop key "' +
          key +
          '" — skipped (use letters, numbers, _ or -)'
        );
        continue;
      }
      var val = String(raw[key] == null ? "" : raw[key])
        .slice(0, 255)
        .replace(/[<>'"&]/g, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+=/gi, "");
      out[key.toLowerCase()] = val;
      count++;
    }
    return out;
  }

  // ─── NETWORK ───────────────────────────────────────────────────────────────

  // sendBeacon always uses credentials: 'include' and can't be changed.
  // Skip it for cross-origin endpoints to avoid CORS preflight failures.
  function isCrossOrigin(url) {
    try {
      return new URL(url).origin !== window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    log("info", "Sending " + payload.type, payload);

    // Only use sendBeacon for same-origin — cross-origin breaks CORS
    if (
      typeof navigator.sendBeacon === "function" &&
      !isCrossOrigin(_endpoint)
    ) {
      var blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(_endpoint, blob)) return;
    }

    // fetch fallback — explicitly omit credentials so no CORS credential
    // check is triggered against your analytics server
    try {
      fetch(_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        credentials: "omit", // ← this is the key fix
      }).catch(function () { });
    } catch (_) { }
  }

  // ─── CORE API ──────────────────────────────────────────────────────────────
  var _lastUrl = "";
  var _lastPageviewTime = 0;
  var PAGEVIEW_THROTTLE_MS = 60 * 1000; // don't re-fire for same URL within 1 min

  function trackPageview(callback) {
    if (!_enabled) {
      log("info", "trackPageview ignored —", _disabledReason);
      return;
    }
    if (isOptedOut()) {
      log("info", "trackPageview ignored — user opted out");
      return;
    }

    var url = window.location.href;
    var now = Date.now();
    if (url === _lastUrl && now - _lastPageviewTime < PAGEVIEW_THROTTLE_MS) {
      log("info", "trackPageview throttled — same URL within 1 min");
      return;
    }
    _lastUrl = url;
    _lastPageviewTime = now;

    var payload = buildBase();
    payload.type = "pageview";
    send(payload);
    if (typeof callback === "function") callback({ status: 200 });
  }

  function trackEvent(eventName, props, callback) {
    if (!_enabled) {
      log("info", "trackEvent ignored —", _disabledReason);
      return;
    }
    if (isOptedOut()) {
      log("info", "trackEvent ignored — user opted out");
      return;
    }
    if (!eventName || typeof eventName !== "string") {
      log("warn", "trackEvent: first argument must be a non-empty string");
      return;
    }

    var payload = buildBase();
    payload.type = "custom";

    var cleanProps = sanitizeProps(props);
    payload.extraData = Object.assign({ eventName: eventName }, cleanProps);

    send(payload);
    if (typeof callback === "function") callback({ status: 200 });
  }

  function identify(traits, callback) {
    if (!_enabled || isOptedOut()) return;
    if (!traits || !traits.user_id) {
      log("warn", "identify: traits.user_id is required");
      return;
    }
    var payload = buildBase();
    payload.type = "identify";
    payload.traits = sanitizeProps(traits);
    send(payload);
    if (typeof callback === "function") callback({ status: 200 });
  }

  // ─── SPA ROUTE TRACKING ────────────────────────────────────────────────────
  var _pendingPageview = null;
  var _lastPathname = window.location.pathname;

  function schedulePageview() {
    if (_pendingPageview) clearTimeout(_pendingPageview);
    // 100ms debounce so document.title is updated before we snapshot it
    _pendingPageview = setTimeout(function () {
      _pendingPageview = null;
      trackPageview();
    }, 100);
  }

  var _origPush = window.history.pushState;
  var _origReplace = window.history.replaceState;

  window.history.pushState = function () {
    _origPush.apply(this, arguments);
    if (window.location.pathname !== _lastPathname) {
      _lastPathname = window.location.pathname;
      schedulePageview();
    }
  };

  window.history.replaceState = function () {
    _origReplace.apply(this, arguments);
    if (window.location.pathname !== _lastPathname) {
      _lastPathname = window.location.pathname;
      schedulePageview();
    }
  };

  window.addEventListener("popstate", function () {
    if (window.location.pathname !== _lastPathname) {
      _lastPathname = window.location.pathname;
      schedulePageview();
    }
  });

  // ─── DECLARATIVE GOAL TRACKING (data-goal) ─────────────────────────────────
  // <button data-goal="signup" data-goal-plan="pro" data-goal-amount="49">Sign up</button>
  // All data-goal-* attributes are collected as event properties automatically.

  function fireGoal(el) {
    var goalName = el.getAttribute("data-goal");
    if (!goalName || !goalName.trim()) return;

    var props = {};
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.name !== "data-goal" && a.name.indexOf("data-goal-") === 0) {
        var key = a.name.slice(10); // strip "data-goal-"
        if (key) props[key.replace(/-/g, "_")] = a.value;
      }
    }
    trackEvent(goalName.trim(), props);
  }

  // ─── DECLARATIVE SCROLL TRACKING (data-scroll-goal) ───────────────────────
  // <section data-scroll-goal="hero_seen" data-scroll-threshold="0.5"></section>
  // Fires once when element crosses threshold. All data-scroll-* attrs = props.

  var _observedEls = new WeakSet();

  function observeScrollGoals(elements) {
    if (!window.IntersectionObserver) {
      log("warn", "IntersectionObserver not supported — scroll goals disabled");
      return;
    }
    elements.forEach(function (el) {
      if (_observedEls.has(el)) return;
      _observedEls.add(el);

      var raw = el.getAttribute("data-scroll-threshold");
      var threshold = parseFloat(raw);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) threshold = 0.5;

      new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var name = el.getAttribute("data-scroll-goal");
            if (!name) return;

            var props = { scroll_threshold: String(threshold) };
            var attrs = el.attributes;
            for (var i = 0; i < attrs.length; i++) {
              var a = attrs[i];
              if (
                a.name !== "data-scroll-goal" &&
                a.name !== "data-scroll-threshold" &&
                a.name.indexOf("data-scroll-") === 0
              ) {
                var key = a.name.slice(12);
                if (key) props[key.replace(/-/g, "_")] = a.value;
              }
            }
            trackEvent(name.trim(), props);
            obs.unobserve(el); // fire once only
          });
        },
        { threshold: threshold }
      ).observe(el);
    });
  }

  function initScrollTracking() {
    observeScrollGoals(document.querySelectorAll("[data-scroll-goal]"));

    // Watch for elements added dynamically (SPAs)
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        var needsScan = false;
        mutations.forEach(function (m) {
          if (m.addedNodes.length) needsScan = true;
        });
        if (needsScan)
          observeScrollGoals(document.querySelectorAll("[data-scroll-goal]"));
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  // ─── CLICK / KEYBOARD DELEGATION ──────────────────────────────────────────
  function onActivation(e) {
    var goalEl = e.target && e.target.closest("[data-goal]");
    if (goalEl) fireGoal(goalEl);

    var anchor = e.target && e.target.closest("a[href]");
    if (anchor) {
      var href = anchor.getAttribute("href");
      if (isTrackableOutbound(href)) {
        try {
          trackExitLink(new URL(href, window.location.href).href);
        } catch (_) { }
      }
    }
  }

  document.addEventListener("click", onActivation, true);
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Enter" || e.key === " ") onActivation(e);
    },
    true
  );

  // ─── QUEUE DRAIN ───────────────────────────────────────────────────────────
  function drainQueue() {
    while (_queue.length > 0) {
      var call = _queue.shift();
      if (!Array.isArray(call) || !call.length) continue;
      var fn = call[0];
      var args = call.slice(1);
      try {
        if (fn === "trackPageview") trackPageview.apply(null, args);
        else if (fn === "trackEvent") trackEvent.apply(null, args);
        else if (fn === "identify") identify.apply(null, args);
        else log("warn", "Unknown queued method:", fn);
      } catch (err) {
        log("error", "Error draining queue:", err);
      }
    }
  }

  // ─── BOOTSTRAP ─────────────────────────────────────────────────────────────
  function init() {
    initScrollTracking();
    trackPageview();
    drainQueue();
    startHeartbeat();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // ─── LIVE HEARTBEAT ────────────────────────────────────────────────────────
  // Sends a heartbeat every 10s so the dashboard knows who is currently online.
  // Uses the same endpoint base as analytics but hits /api/live/heartbeat.
  // Pauses when tab is hidden to save bandwidth.

  var _heartbeatInterval = null;
  // var _liveEndpoint = isCDN
  //   ? "http://localhost:8888/api/live/heartbeat"
  //   : new URL("/api/live/heartbeat", window.location.origin).href;
  var _liveEndpoint = _src
    ? new URL("/api/live/heartbeat", _src).href
    : "http://localhost:3000/api/live/heartbeat";

  function sendHeartbeat() {
    if (!_enabled || isOptedOut()) return;
    if (document.hidden) return; // don't send when tab not visible

    var body = JSON.stringify({
      workspaceId: _websiteId,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      page: window.location.pathname,
      url: window.location.href,
    });

    // Use sendBeacon for heartbeats — survives page unload perfectly
    if (
      typeof navigator.sendBeacon === "function" &&
      !isCrossOrigin(_liveEndpoint)
    ) {
      navigator.sendBeacon(
        _liveEndpoint,
        new Blob([body], { type: "application/json" })
      );
      return;
    }

    // fetch fallback
    try {
      fetch(_liveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        credentials: "omit",
      }).catch(function () { });
    } catch (_) { }
  }

  function startHeartbeat() {
    if (!_enabled || isOptedOut()) return;
    sendHeartbeat(); // send immediately on load
    _heartbeatInterval = setInterval(sendHeartbeat, 10000); // then every 10s

    // Resume when tab becomes visible again
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) sendHeartbeat();
    });

    // Stop on page unload — beacon already handles the final ping
    window.addEventListener("beforeunload", function () {
      if (_heartbeatInterval) clearInterval(_heartbeatInterval);
    });
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  window.analytics = {
    trackPageview: trackPageview,
    trackEvent: trackEvent,
    identify: identify,
  };

  // ─── window.convrs ALIAS ──────────────────────────────────────────────────
  // Mirrors the convrs calling convention exactly:
  //
  //   window.convrs("initiate_checkout", { plan: "pro", email: "a@b.com" })
  //   window.convrs("identify", { user_id: "u_123", name: "Jane" })
  //   window.convrs("pageview")
  //
  // Special event names:
  //   "pageview"          → trackPageview()
  //   "identify"          → identify(props)   requires props.user_id
  //   anything else       → trackEvent(name, props)

  function convrs(eventName, props) {
    if (!eventName || typeof eventName !== "string") {
      log("warn", "window.convrs: first argument must be a non-empty string");
      return;
    }

    if (eventName === "pageview") {
      trackPageview();
      return;
    }

    if (eventName === "identify") {
      if (!props || !props.user_id) {
        log("warn", "window.convrs: identify requires props.user_id");
        return;
      }
      identify(props);
      return;
    }

    // Everything else is a custom event
    trackEvent(eventName, props);
  }

  // Drain any pre-init queue: window.convrs = { q: [] } pattern
  // Usage before script loads:
  //   window.convrs = window.convrs || { q: [] };
  //   window.convrs.q.push(["initiate_checkout", { plan: "pro" }]);
  if (window.convrs && window.convrs.q && Array.isArray(window.convrs.q)) {
    var _convrsQueue = window.convrs.q.slice();
    window.convrs = convrs;
    for (var _i = 0; _i < _convrsQueue.length; _i++) {
      var _call = _convrsQueue[_i];
      if (Array.isArray(_call) && _call.length) {
        try {
          convrs.apply(null, _call);
        } catch (_) { }
      }
    }
  } else {
    window.convrs = convrs;
  }
})();
