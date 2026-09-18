import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "API Reference — Convrs",
  description: "Read access to your Convrs analytics and revenue data.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-[13px] leading-relaxed text-neutral-100">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-neutral-200 py-10 first:border-t-0">
      <h2 className="mb-4 text-xl font-semibold text-neutral-900">{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

function Endpoint({
  method,
  path,
  scope,
  description,
  params,
  fields,
  curl,
  js,
}: {
  method: string;
  path: string;
  scope: string | null;
  description: string;
  params?: { name: string; description: string }[];
  fields: { name: string; description: string }[];
  curl: string;
  js: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-800">
          {method}
        </span>
        <code className="text-sm font-medium text-neutral-900">{path}</code>
        {scope ? (
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-600">
            scope: {scope}
          </span>
        ) : (
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            any valid token
          </span>
        )}
      </div>
      <p className="mb-3 text-sm text-neutral-600">{description}</p>

      {params && params.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Query parameters
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {params.map((p) => (
              <li key={p.name}>
                <code className="text-neutral-900">{p.name}</code> — {p.description}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Response fields
      </p>
      <ul className="mt-1 space-y-1 text-sm">
        {fields.map((f) => (
          <li key={f.name}>
            <code className="text-neutral-900">{f.name}</code> — {f.description}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        cURL
      </p>
      <Code>{curl}</Code>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        JavaScript
      </p>
      <Code>{js}</Code>
    </div>
  );
}

const commonFilterParams = [
  { name: "startAt / endAt", description: "ISO 8601 date range. Overrides `interval` when set. Max range: 366 days." },
  { name: "interval", description: "Relative range shortcut: 24h, 7d, 30d, 90d, 1y, mtd, qtd, ytd. Default: 30d." },
  { name: "timezone", description: "IANA timezone for bucketing, e.g. America/New_York. Default: UTC." },
  { name: "websiteId", description: "Defaults to the website your token is scoped to. If provided, must match it or the request is rejected." },
  { name: "country, city, region, continent, device, browser, os, referer, refererUrl, hostname, page, entrypage, exitlink, utm_source, utm_medium, utm_campaign, utm_term, utm_content, goal, saleType", description: "Filters. Each accepts a single value, a comma-separated list, or an exclusion prefixed with `-` (e.g. `country=US,CA` or `country=-US`)." },
];

export default function ApiReferencePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-emerald-600">Convrs</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">API Reference</h1>
        <p className="mt-2 text-neutral-600">
          Read access to the analytics and revenue data your API token is authorized for. Machine-readable spec: {" "}
          <code>/api/v1/openapi.json</code>.
        </p>
      </header>

      <Section id="introduction" title="Introduction">
        <p>
          The Convrs API gives your scripts, CLI tools, backend, or AI agents read access to the
          same analytics and revenue data shown in your Convrs dashboard — computed by the exact
          same query layer, so the numbers always match.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Base URL:</strong> <code>https://app.convrs.dev/api/v1</code></li>
          <li><strong>Version:</strong> <code>v1</code> (see Versioning below)</li>
          <li><strong>Format:</strong> JSON in, JSON out</li>
          <li><strong>Auth:</strong> Bearer token (see Authentication below)</li>
        </ul>
      </Section>

      <Section id="authentication" title="Authentication">
        <p>
          Every request needs an <code>Authorization: Bearer &lt;token&gt;</code> header. Never
          put a token in a URL or query string.
        </p>
        <h3 className="font-medium text-neutral-900">Creating a token</h3>
        <p>
          Create, name, scope, and revoke tokens from your workspace&apos;s{" "}
          <strong>Settings → API Tokens</strong> page. Tokens cannot be created, listed, or
          revoked through the API itself — token management is dashboard-only, by design, so a
          token can never be used to mint or revoke other tokens.
        </p>
        <h3 className="font-medium text-neutral-900">Token format</h3>
        <p>
          New tokens are prefixed <code>cvrs_</code>. Tokens created before this API existed use a
          legacy <code>bc_</code> prefix and continue to work.
        </p>
        <h3 className="font-medium text-neutral-900">Scopes</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><code>websites.read</code> — read website (workspace) metadata</li>
          <li><code>analytics.read</code> — read analytics, realtime, bot-traffic, and customer data</li>
          <li><code>goals.read</code> — read goal definitions and goal-completion analytics</li>
          <li><code>payments.read</code> — read the redacted payments list</li>
          <li><code>apis.read</code> — shorthand for all current and future read scopes</li>
          <li><code>apis.all</code> — full access to all API scopes</li>
        </ul>
        <p className="text-sm text-neutral-500">
          Reserved for future endpoints (not yet selectable): <code>goals.write</code>,{" "}
          <code>websites.write</code>.
        </p>
        <h3 className="font-medium text-neutral-900">A token is scoped to one website</h3>
        <p>
          Each token is bound to exactly one workspace at creation time. It can never read another
          workspace&apos;s data — even if you pass a different <code>websiteId</code> in a
          request, the API will reject it (<code>403 forbidden</code>) rather than silently
          ignoring it.
        </p>
        <h3 className="font-medium text-neutral-900">Security guidance</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Store tokens as secrets (environment variables), never in client-side code.</li>
          <li>Grant the narrowest scope that does the job.</li>
          <li>Revoke a token immediately if it may have leaked — this takes effect immediately.</li>
          <li>Tokens are shown in full exactly once, at creation. Convrs never stores or displays the raw token again — only a SHA-256 hash.</li>
        </ul>
      </Section>

      <Section id="quickstart" title="Quickstart">
        <Code>{`curl "https://app.convrs.dev/api/v1/account" \\
  -H "Authorization: Bearer cvrs_xxx"`}</Code>
        <Code>{`const res = await fetch("https://app.convrs.dev/api/v1/analytics?interval=30d", {
  headers: { Authorization: "Bearer cvrs_xxx" },
});
const { data } = await res.json();
console.log(data.visitors, data.revenue);`}</Code>
      </Section>

      <Section id="endpoints" title="Endpoints">
        <div className="space-y-6">
          <Endpoint
            method="GET"
            path="/api/v1/account"
            scope={null}
            description="Verify your token works and see basic authenticated context."
            fields={[
              { name: "user.id, user.name, user.email", description: "The user who created the token." },
              { name: "website.id, website.name, website.domain", description: "The website this token is scoped to." },
              { name: "token.name, token.scopes", description: "This token's own name and granted scopes." },
              { name: "plan.plan, plan.planFamily, plan.status", description: "Workspace plan and active/inactive status." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/account" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/account", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/websites"
            scope="websites.read"
            description="List websites this token can access. Currently always a single-item array (one token = one website)."
            fields={[
              { name: "id", description: "Website ID, e.g. ws_xxxxx." },
              { name: "name, domain, timezone, currency, createdAt", description: "Website metadata." },
              { name: "plan, planFamily", description: "Workspace plan." },
              { name: "status", description: "\"active\" or \"inactive\" (billing entitlement)." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/websites" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/websites", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/websites/:websiteId"
            scope="websites.read"
            description="Get one website by ID. Must match the token's own website, or 403."
            fields={[{ name: "(same fields as list)", description: "" }]}
            curl={`curl "https://app.convrs.dev/api/v1/websites/ws_xxx" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/websites/ws_xxx", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics"
            scope="analytics.read"
            description="Composite analytics overview for a single date range."
            params={[
              ...commonFilterParams,
              { name: "metrics", description: "Comma-separated subset of: visitors, new_visitors, returning_visitors, bounce_rate, avg_session_duration, conversion_rate, revenue_per_visitor, revenue|mrr, new_revenue, refund_amount. Default: all." },
            ]}
            fields={[{ name: "<each requested metric>", description: "A number, keyed by its public metric name." }]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics?interval=30d&metrics=visitors,revenue" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics?interval=30d&metrics=visitors,revenue", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/timeseries"
            scope="analytics.read"
            description="The same composite metrics as /analytics, grouped by day/hour/month (chosen automatically from the date range)."
            params={commonFilterParams.concat([{ name: "metrics", description: "Same as /analytics." }])}
            fields={[
              { name: "date", description: "ISO 8601 timestamp for the start of the bucket." },
              { name: "<each requested metric>", description: "A number for that bucket." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/timeseries?metrics=visitors,revenue&interval=day&startAt=2026-09-01&endAt=2026-09-15" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/timeseries?metrics=visitors,revenue&startAt=2026-09-01&endAt=2026-09-15", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/pages"
            scope="analytics.read"
            description="Breakdown by page, hostname, entry page, or exit link."
            params={commonFilterParams.concat([
              { name: "dimension", description: "page (default) | hostname | entrypage | exitlink" },
              { name: "metrics", description: "Subset of: visitors, conversions, revenue|mrr, revenue_per_visitor, conversion_rate. Default: all." },
              { name: "page, limit", description: "Pagination. limit max 500, default 100." },
            ])}
            fields={[
              { name: "page / hostname / entrypage / exitlink", description: "The dimension value (name matches the requested `dimension`)." },
              { name: "<each requested metric>", description: "A number for that row." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/pages?dimension=page&limit=50" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/pages?dimension=page&limit=50", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/sources"
            scope="analytics.read"
            description="Breakdown by referrer or UTM parameters."
            params={commonFilterParams.concat([
              { name: "dimension", description: "referrer (default) | referrer_url | utm_source | utm_medium | utm_campaign | utm_term | utm_content | campaign" },
              { name: "metrics, page, limit", description: "Same as /analytics/pages." },
            ])}
            fields={[
              { name: "referrer / referrerUrl / utmSource / utmMedium / utmCampaign / utmTerm / utmContent / campaign", description: "The dimension value." },
              { name: "<each requested metric>", description: "A number for that row." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/sources?dimension=utm_source" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/sources?dimension=utm_source", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/geo"
            scope="analytics.read"
            description="Breakdown by country, region, city, or continent."
            params={commonFilterParams.concat([
              { name: "dimension", description: "country (default) | region | city | continent" },
              { name: "metrics, page, limit", description: "Same as /analytics/pages." },
            ])}
            fields={[
              { name: "country / region / city / continent", description: "The dimension value (region/city rows also include `country`; city rows also include `region`)." },
              { name: "<each requested metric>", description: "A number for that row." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/geo?dimension=country" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/geo?dimension=country", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/devices"
            scope="analytics.read"
            description="Breakdown by device, browser, or OS."
            params={commonFilterParams.concat([
              { name: "dimension", description: "device (default) | browser | os" },
              { name: "metrics, page, limit", description: "Same as /analytics/pages." },
            ])}
            fields={[
              { name: "device / browser / os", description: "The dimension value." },
              { name: "<each requested metric>", description: "A number for that row." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/devices?dimension=browser" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/devices?dimension=browser", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/revenue"
            scope="analytics.read"
            description="Revenue-focused snapshot with an explicit currency field. For revenue over time, use /analytics/timeseries?metrics=revenue."
            params={commonFilterParams.concat([{ name: "metrics", description: "Subset of: revenue|mrr, new_revenue, refund_amount, revenue_per_visitor, conversion_rate. Default: all." }])}
            fields={[
              { name: "currency", description: "ISO 4217 code (workspace's display currency)." },
              { name: "<each requested metric>", description: "A number, in `currency`." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/revenue?interval=30d" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/revenue?interval=30d", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />
          <Endpoint
            method="GET"
            path="/api/v1/analytics/realtime"
            scope="analytics.read"
            description="Live visitor count, current pages, referrers, countries, and geo points for a realtime map. No date-range params — this is always 'right now'."
            fields={[
              { name: "count", description: "Visitors active in the last 30 seconds." },
              { name: "pages", description: "Array of { page, count }." },
              { name: "points", description: "Array of { id, latitude, longitude, value } for a live map." },
              { name: "referrers", description: "Array of { source, count }." },
              { name: "countries", description: "Array of { country, code, count }." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/realtime" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/realtime", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/bots"
            scope="analytics.read"
            description="Convrs's AI-crawler / bot-traffic detector, broken down by vendor, category, or top pages."
            params={[
              ...commonFilterParams,
              { name: "breakdown", description: "count (default) | timeseries | providers | top_pages | categories" },
              { name: "domain", description: "Filter to one tracked hostname." },
              { name: "category", description: "answer_agent | index_crawler | training_crawler | other" },
              { name: "granularity", description: "hour | day | week — only used by breakdown=timeseries." },
              { name: "page, limit", description: "Pagination — only used by breakdown=providers/top_pages/categories." },
            ]}
            fields={[
              { name: "(count)", description: "{ total_requests, ai_answers, indexing, training, other, unique_providers }" },
              { name: "(timeseries)", description: "Array of { bucket_start (or start), <vendor>: requests, ... } — one key per bot vendor seen." },
              { name: "(providers/top_pages/categories)", description: "Paginated array of rows specific to that breakdown." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/bots?breakdown=categories" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/bots?breakdown=categories", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/goals"
            scope="goals.read"
            description="The goal catalogue for this website (TrackedEvent rows of type goals)."
            params={[
              { name: "websiteId", description: "Same scoping rule as other endpoints." },
              { name: "page, limit", description: "Pagination. limit max 500, default 100." },
            ]}
            fields={[
              { name: "eventName", description: "The goal's name, as passed to convrs('goalName')." },
              { name: "eventType", description: "Always \"goals\"." },
              { name: "trigger", description: "How the goal fires, e.g. \"goal\"." },
              { name: "firstSeenAt, lastSeenAt", description: "When this goal was first/most recently recorded." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/goals" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/goals", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/goals"
            scope="goals.read"
            description="Goal completions over time."
            params={[
              ...commonFilterParams,
              { name: "goals", description: "Comma-separated goal names to filter to (from GET /api/v1/goals). Defaults to all goals." },
            ]}
            fields={[
              { name: "date", description: "ISO 8601 timestamp for the start of the bucket." },
              { name: "goal", description: "The goal name." },
              { name: "count", description: "Completions in that bucket." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/goals?goals=signup" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/goals?goals=signup", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/customers"
            scope="analytics.read"
            description="List customers — Convrs's identified + anonymous visitor model (there's no separate 'visitor' resource; an anonymous visitor is a Customer whose externalId is their visitor_id)."
            params={[
              { name: "websiteId", description: "Same scoping rule as other endpoints." },
              { name: "limit", description: "Max 500, default 100. Note: this endpoint returns the first `limit` customers only — it doesn't yet support paging past that with a `page` param." },
            ]}
            fields={[
              { name: "id, name, email, avatar, externalId, country, device, browser", description: "Identity/profile fields." },
              { name: "sales, saleAmount, firstSaleAt, subscriptionCanceledAt", description: "Revenue rollups." },
              { name: "createdAt, updatedAt", description: "Timestamps." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/customers?limit=50" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/customers?limit=50", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/customers/:customerId"
            scope="analytics.read"
            description="Get one customer by ID. A customer ID from another website always 404s — never a cross-tenant read."
            fields={[{ name: "(same fields as list)", description: "" }]}
            curl={`curl "https://app.convrs.dev/api/v1/customers/cust_xxx" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/customers/cust_xxx", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/customers/:customerId/activity"
            scope="analytics.read"
            description="That customer's event history, grouped by day (pageviews, goals, revenue events)."
            fields={[
              { name: "date", description: "Human-readable day label." },
              { name: "items", description: "Array of raw events for that day: event_type, event_name, page, url, referer, browser, device, country, utm_*, event_properties, revenue, currency." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/customers/cust_xxx/activity" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/customers/cust_xxx/activity", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/payments"
            scope="payments.read"
            description="A redacted list of payments. Never includes provider-side identifiers (externalSessionId/externalPaymentId/externalEventId) or customer email."
            params={[
              { name: "websiteId", description: "Same scoping rule as other endpoints." },
              { name: "page, limit", description: "Pagination. limit max 500, default 100." },
            ]}
            fields={[
              { name: "id, amount, currency, provider", description: "amount is in the smallest currency unit (cents)." },
              { name: "isRecurring, billingInterval", description: "Whether this payment settles a subscription, and its interval." },
              { name: "createdAt, attributionStatus, customerId", description: "Timestamps and attribution linkage." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/payments?limit=50" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/payments?limit=50", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/meta"
            scope="analytics.read"
            description="The actual metrics, dimensions, and goal catalogue this website's data supports — derived live from the same definitions the other endpoints use, plus this website's real goals."
            fields={[
              { name: "intervals", description: "Valid `interval` values." },
              { name: "analytics.metrics", description: "Valid metrics for /analytics and /analytics/timeseries." },
              { name: "breakdowns.{pages,sources,geo,devices}", description: "Valid `dimension` values and metrics for each breakdown endpoint." },
              { name: "revenue.metrics", description: "Valid metrics for /analytics/revenue." },
              { name: "bots.breakdowns, bots.categories", description: "Valid values for /analytics/bots." },
              { name: "goals", description: "This website's actual goal names, from GET /api/v1/goals." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/meta" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/meta", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/funnels"
            scope="analytics.read"
            description="List this website's saved funnel definitions."
            params={[
              { name: "websiteId", description: "Same scoping rule as other endpoints." },
              { name: "page, limit", description: "Pagination. limit max 500, default 100." },
            ]}
            fields={[
              { name: "id, name, createdAt, updatedAt", description: "Funnel metadata." },
              { name: "steps", description: "Ordered array of { id, name, value, type, order }. type is 'goal' or 'page_view'." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/funnels" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/funnels", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/funnels/:funnelId"
            scope="analytics.read"
            description="Get one funnel's definition and ordered steps. A funnel ID from another website always 404s."
            fields={[{ name: "(same fields as list item)", description: "" }]}
            curl={`curl "https://app.convrs.dev/api/v1/funnels/cly8k2p3q0000abcxyz12345" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/funnels/cly8k2p3q0000abcxyz12345", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/funnels/:funnelId"
            scope="analytics.read"
            description="Step-by-step conversion counts, plus each step's top referrers and countries. No date-range parameters — the underlying pipes always compute all-time. Steps of type 'page_view' are not currently evaluated by the underlying pipe (it only matches goal-event names), so such a step always shows 0 users; this matches the dashboard's own funnel feature exactly, it is not an API-specific gap."
            fields={[
              { name: "step", description: "The step's value (goal name)." },
              { name: "users", description: "Distinct visitors who completed this step and every step before it, in order." },
              { name: "topSources", description: "Top 3 referrers reaching this step: { referer, visitors, pct }." },
              { name: "topCountries", description: "Top 3 countries reaching this step: { country, visitors, pct }." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/funnels/cly8k2p3q0000abcxyz12345" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/funnels/cly8k2p3q0000abcxyz12345", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/goals/properties"
            scope="goals.read"
            description="Custom event-property values recorded alongside a goal completion, grouped with counts. Only workspaceId, goal, and the date range apply here — the underlying pipe has no hostname/page/device/etc. filter support for this specific query, unlike other analytics endpoints."
            params={[
              { name: "goal", description: "The goal name to analyze (from GET /api/v1/goals). If omitted, aggregates across all goals, which usually mixes unrelated property keys." },
              { name: "startAt / endAt, interval, timezone, websiteId", description: "Same as other analytics endpoints." },
              { name: "page, limit", description: "Pagination. limit max 500, default 100." },
            ]}
            fields={[
              { name: "propertyKey", description: "The custom property's key, e.g. \"plan\"." },
              { name: "propertyValue", description: "The value recorded for that key, e.g. \"pro\"." },
              { name: "count", description: "Distinct visitors who completed the goal with that property value." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/goals/properties?goal=signup" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/goals/properties?goal=signup", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/revenue/timeseries"
            scope="analytics.read"
            description="Revenue over time — the same composite timeseries as /analytics/timeseries, restricted to revenue metrics."
            params={commonFilterParams.concat([{ name: "metrics", description: "Subset of: revenue|mrr, new_revenue, refund_amount, revenue_per_visitor, conversion_rate. Default: all except mrr." }])}
            fields={[
              { name: "currency", description: "ISO 4217 code (workspace's display currency)." },
              { name: "points", description: "Array of { date, <each requested metric> }." },
            ]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/revenue/timeseries?interval=30d" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/revenue/timeseries?interval=30d", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/revenue/by-source"
            scope="analytics.read"
            description="Revenue attributed to the visitor's referrer/UTM parameters at last touch before purchase (real last-touch attribution — see the Attribution note below, not a fabricated join)."
            params={commonFilterParams.concat([
              { name: "dimension", description: "referrer (default) | referrer_url | utm_source | utm_medium | utm_campaign | utm_term | utm_content | campaign" },
              { name: "metrics, page, limit", description: "Subset of: revenue, conversions, revenue_per_visitor, conversion_rate (no mrr or visitors — see note). Pagination as elsewhere." },
            ])}
            fields={[{ name: "<dimension field> / <each requested metric>", description: "Same shape as /api/v1/analytics/sources." }]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/revenue/by-source?dimension=utm_source" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/revenue/by-source?dimension=utm_source", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/revenue/by-campaign"
            scope="analytics.read"
            description="Revenue grouped by campaign attribution (same mechanism as by-source)."
            params={commonFilterParams.concat([
              { name: "dimension", description: "utm_campaign (default) | campaign (full attribution query string)" },
              { name: "metrics, page, limit", description: "Same as /analytics/revenue/by-source." },
            ])}
            fields={[{ name: "utmCampaign / campaign, <each requested metric>", description: "" }]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/revenue/by-campaign" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/revenue/by-campaign", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/analytics/revenue/by-page"
            scope="analytics.read"
            description="Revenue grouped by the page the visitor was last on before purchase. Only page and hostname — not entrypage/exitlink, which are never recorded on revenue events (see the code comment in the route for why)."
            params={commonFilterParams.concat([
              { name: "dimension", description: "page (default) | hostname" },
              { name: "metrics, page, limit", description: "Same as /analytics/revenue/by-source." },
            ])}
            fields={[{ name: "page / hostname, <each requested metric>", description: "" }]}
            curl={`curl "https://app.convrs.dev/api/v1/analytics/revenue/by-page" \\\n  -H "Authorization: Bearer cvrs_xxx"`}
            js={`await fetch("https://app.convrs.dev/api/v1/analytics/revenue/by-page", {\n  headers: { Authorization: "Bearer cvrs_xxx" },\n}).then((r) => r.json());`}
          />
        </div>

        <p className="mt-6 text-sm text-neutral-500">
          <strong>Attribution note:</strong> revenue events are recorded from a server-side
          payment webhook, not a live browser session — <code>page</code>, <code>referer</code>,
          and <code>utm_*</code> on a revenue event come from the visitor&apos;s most recent
          pageview before the purchase (last-touch attribution), looked up at payment time.
          Unattributed payments (no matching prior visitor session) are recorded with zero
          revenue and excluded from these sums, so revenue totals here always match{" "}
          <code>/api/v1/analytics/revenue</code>.
        </p>

        <p className="mt-4 text-sm text-neutral-500">
          <strong>Not yet available</strong> (deferred to a later version): a public integrations
          API, a server-side identify/write API, alerts CRUD, alert firing history, notes,
          team/access data, funnel create/update/delete via the API, retention/cohort analytics,
          and technology/version (browser/OS version) breakdowns. Token management
          (create/list/revoke) is intentionally dashboard-only and will not be added to{" "}
          <code>/api/v1</code>.
        </p>
      </Section>

      <Section id="errors" title="Error reference">
        <p>Every error responds with <code>{`{ "error": { "code": "...", "message": "..." } }`}</code>.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="py-1 pr-4">Status</th>
                <th className="py-1 pr-4">Code</th>
                <th className="py-1">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr><td className="py-1 pr-4">400</td><td className="py-1 pr-4"><code>bad_request</code></td><td className="py-1">Invalid query parameters, date range, or metric name.</td></tr>
              <tr><td className="py-1 pr-4">401</td><td className="py-1 pr-4"><code>unauthorized</code></td><td className="py-1">Missing, malformed, invalid, expired, or revoked token.</td></tr>
              <tr><td className="py-1 pr-4">403</td><td className="py-1 pr-4"><code>forbidden</code></td><td className="py-1">Token lacks the required scope, or the request targets a website outside the token's scope.</td></tr>
              <tr><td className="py-1 pr-4">404</td><td className="py-1 pr-4"><code>not_found</code></td><td className="py-1">Resource doesn't exist.</td></tr>
              <tr><td className="py-1 pr-4">429</td><td className="py-1 pr-4"><code>rate_limit_exceeded</code></td><td className="py-1">Too many requests — see Retry-After header.</td></tr>
              <tr><td className="py-1 pr-4">500</td><td className="py-1 pr-4"><code>internal_server_error</code></td><td className="py-1">Unexpected server error.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="limits" title="API limits">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Rate limit:</strong> 60 requests/minute per token. Exceeding it returns <code>429</code> with a <code>Retry-After</code> header (seconds).</li>
          <li><strong>Max date range:</strong> 366 days when using <code>startAt</code>/<code>endAt</code>. The <code>all</code> interval preset available in the dashboard is not available via the API.</li>
          <li><strong>Pagination:</strong> <code>limit</code> defaults to 100, maximum 500. Breakdown queries are additionally capped upstream at 5,000 rows.</li>
        </ul>
      </Section>

      <Section id="versioning" title="Versioning">
        <p>
          The current version is <code>v1</code> (<code>/api/v1/...</code>). Breaking changes to
          v1 response shapes or parameter semantics will not be made casually — a new version
          would be introduced instead.
        </p>
      </Section>
    </main>
  );
}
