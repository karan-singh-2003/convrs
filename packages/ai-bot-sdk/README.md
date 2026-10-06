# @convrs/ai-bot-sdk

Server-side SDK to detect and track AI crawlers, answer agents, and search
bots (GPTBot, ClaudeBot, PerplexityBot, Googlebot, and 20+ more vendors)
hitting your site or API, and report those visits to Convrs.

## Install

```bash
npm install @convrs/ai-bot-sdk
```

AI crawlers usually fetch raw HTML and never run your JavaScript, so this runs
on your server. Tracking is best-effort and never awaited: on runtimes with
`waitUntil` (Vercel, Cloudflare) the request is sent in the background.

All you need is your **website ID**: the same public ID your Convrs tracking
script uses (`data-website-id`). Bot traffic has its own daily allowance and
never uses your plan's event quota.

**Optional: bot token.** For extra assurance, generate a token under
Settings → Script → Bot traffic (`cvbot_…`), keep it in a server-side
environment variable, and pass it as `authToken`. Events sent with it are
marked authenticated in the dashboard, and you can then turn on "Reject
unauthenticated requests" so only your servers can report bot traffic. An
existing API token (`cvrs_…`) also works. A token that is sent but wrong or
rotated is always rejected.

## Next.js / Vercel (`proxy.ts` or `middleware.ts`)

```ts
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { trackAICrawlerRequest } from "@convrs/ai-bot-sdk";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  trackAICrawlerRequest(request, event, {
    websiteId: "YOUR_CONVRS_WEBSITE_ID",
    // Optional hardening: authToken: process.env.CONVRS_BOT_TOKEN,
  });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## Express

```ts
import express from "express";
import { createExpressAICrawlerMiddleware } from "@convrs/ai-bot-sdk";

const app = express();
app.set("trust proxy", 1); // so req.ip is the client, if you run behind a proxy
app.use(
  createExpressAICrawlerMiddleware({
    websiteId: "YOUR_CONVRS_WEBSITE_ID",
  })
);
```

## Cloudflare Pages (`functions/_middleware.ts`)

```ts
import { trackAICrawlerRequest } from "@convrs/ai-bot-sdk";

export async function onRequest(context) {
  trackAICrawlerRequest(context.request, context, {
    websiteId: "YOUR_CONVRS_WEBSITE_ID",
    ipSource: "cloudflare",
  });
  return context.next();
}
```

## Cloudflare Workers / any fetch-style handler

```ts
import { withAICrawlerTracking } from "@convrs/ai-bot-sdk";

export default {
  fetch: withAICrawlerTracking(
    async (request: Request, env: Env, ctx: ExecutionContext) => fetch(request),
    { websiteId: "your-website-id", ipSource: "cloudflare" }
  ),
};
```

## Hono

```ts
import { trackAICrawlerResponse } from "@convrs/ai-bot-sdk";

app.use("*", async (c, next) => {
  await next();
  trackAICrawlerResponse(c.req.raw, c.res, c.executionCtx, { websiteId: "your-website-id" });
});
```

Response-based integrations (Express, `withAICrawlerTracking`,
`trackAICrawlerResponse`) report the real HTTP status code. Request-only
middleware (`trackAICrawlerRequest`) runs before the response exists and
sends none.

The 1.0 names (`createBotTrackingMiddleware`, `createExpressBotMiddleware`,
`withBotTracking`, `siteId`) still work.

## What gets tracked

Skipped by default: `/api`, `/_next` and other framework/static prefixes, and
asset extensions (`.js`, `.css`, images, fonts, …). Always tracked, because
crawlers fetch them first: `/robots.txt`, `/llms.txt`, `/llms-full.txt`,
`sitemap*.xml`, and Markdown files.

## Direct HTTP (any backend)

`POST https://ingest.convrs.dev/api/ai-crawls`, JSON body up to 16 KB
(optionally with `Authorization: Bearer cvbot_…`):

```json
{
  "websiteId": "your-website-id",
  "domain": "example.com",
  "href": "https://example.com/docs/get-started",
  "ai": {
    "userAgent": "Mozilla/5.0 ... ChatGPT-User/1.0",
    "ip": "203.0.113.10",
    "statusCode": 200,
    "source": "server_middleware"
  }
}
```

`url`/`bot` are accepted as aliases of `href`/`ai`. Send the full raw
User-Agent and drop the query string; don't send a provider or category
(Convrs classifies server-side). The URL's hostname must be one of the
website's allowed hostnames.

## Just classify a User-Agent

```ts
import { classifyBotUserAgent } from "@convrs/ai-bot-sdk";

classifyBotUserAgent(req.headers.get("user-agent"));
// => { vendor: "OpenAI", agentName: "gptbot", category: "training_crawler" } | null
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `websiteId` (or `siteId`) | — | Required. Your Convrs website id (the script's `data-website-id`). |
| `enabled` | `true` | Master on/off switch. |
| `endpoint` | Convrs ingest URL | Override for self-hosting/testing. |
| `timeoutMs` | `1000` | Abort the tracking call after this long. Never retried. |
| `authToken` | — | Optional. The website's bot-traffic token (`cvbot_…`) or an API token (`cvrs_…`). Marks events as authenticated; required only if the website turned on "Reject unauthenticated requests". A wrong or rotated token is rejected. |
| `trackedMethods` | `["GET","HEAD"]` | HTTP methods eligible for tracking. |
| `skipIndexCrawlers` / `disableSearchCrawlers` | `false` | Skip Googlebot/Bingbot-style crawlers. |
| `skipAnswerAgents` / `disableAnswerFetch` | `false` | Skip ChatGPT-User/Perplexity-User style real-time fetchers. |
| `skipTrainingCrawlers` / `disableTrainingCrawlers` | `false` | Skip GPTBot/CCBot-style dataset crawlers. |
| `skipOtherBots` / `disableOtherCrawlers` | `false` | Skip anything not in the three categories above. Skipped requests are never sent and don't count toward usage. |
| `ignoredPathPrefixes` / `extraIgnoredPathPrefixes` | see `registry.ts` | Paths never tracked (e.g. `/api`, `/_next`). |
| `ignoredExtensions` / `extraIgnoredExtensions` | see `registry.ts` | File extensions never tracked. |
| `maxUrlLength` | `8192` | Drop events for implausibly long URLs. |
| `domain` | request host | Force the reported host (also rewrites the reported URL). Must be one of the workspace's allowed hostnames. |
| `publicOrigin` | — | Rewrite request URL to a public origin (behind tunnels/proxies). |
| `fetch` | global `fetch` | Custom fetch implementation. |
| `ipSource` | `"auto"` | Which infrastructure header to trust for the crawler IP: `auto` (Vercel on Vercel, else the adapter's `req.ip`), `vercel`, `cloudflare`, `x-forwarded-for` (only behind a proxy you control), `none`. Unknown means no IP is sent. |
| `resolveIp` | — | Custom IP resolution; takes precedence over `ipSource`. |
| `keepQueryParams` | `[]` | Query parameters to keep in reported URLs. The query string is dropped by default (it often carries tokens/PII); `["*"]` keeps all. |
| `excludePaths` | — | Exact paths (or prefixes ending in `/`) never reported, e.g. ones a `withBotTracking` handler already reports. |
| `filter` | — | Final `(url, bot) => boolean` gate. |
| `debug` | `false` | Log internal warnings to console. |

## Bot categories

- `answer_agent` — real-time, on-demand fetches triggered by a user's chat prompt (e.g. `ChatGPT-User`, `Perplexity-User`).
- `index_crawler` — crawlers that build a search index (e.g. `Googlebot`, `Bingbot`).
- `training_crawler` — crawlers that harvest content for model training datasets (e.g. `GPTBot`, `CCBot`).
- `other` — everything else: known agents outside those buckets, unregistered agents from a known vendor, and generic automation (reported as agent `unknown_bot`).

Classification is repeated server-side from the raw User-Agent; the category
the SDK sends is informational only. Where a vendor publishes IP ranges or
reverse-DNS domains, Convrs also records whether the crawler's IP matches
(`verified`, `spoofed`, `unverifiable`, `unknown`).

## Privacy and delivery

- Each tracked visit gets one `eventId`; Convrs counts it once even if delivered twice.
- URLs are reported without query string or fragment unless allow-listed; referrers are reduced to origin + path.
- Tracking is fire-and-forget: it never throws into your handler and never retries.

## License

MIT
