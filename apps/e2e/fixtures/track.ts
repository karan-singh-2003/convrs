import { randomToken } from "./seed";

export function buildPageviewPayload(opts: {
  websiteId: string;
  eventId?: string;
  cookieless?: boolean;
}) {
  return {
    websiteId: opts.websiteId,
    visitorId: randomToken("vid"),
    sessionId: randomToken("sid"),
    timezone: "UTC",
    domain: "example.com",
    href: "https://example.com/pricing",
    language: "en-US",
    entrypage: "/pricing",
    referrer: null,
    screenWidth: 1920,
    screenHeight: 1080,
    viewport: { width: 1280, height: 800 },
    type: "pageview",
    ...(opts.eventId && { eventId: opts.eventId }),
    ...(opts.cookieless && { cookieless: true }),
  };
}

export const REAL_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
