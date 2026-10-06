// "use client";

// import { useState } from "react";
// import { BarList } from "./bar-list";
// import { ChatGptIcon, GeminiIcon, ClaudeIcon, DuckDuckGoIcon } from "@/ui/icons/ai";
// import { BotFilteringAreaChart } from "./bot-filtering-chart";

// type BotStat = {
//     name: string;
//     count: number;
//     percentage: number;
//     icon: React.ComponentType<{ className?: string }>;
// };

// const BOT_FILTERING_ANALYTICS: BotStat[] = [
//     { name: "ChatGPT", count: 734, percentage: 87, icon: ChatGptIcon },
//     { name: "Gemini", count: 91, percentage: 11, icon: GeminiIcon },
//     { name: "Claude", count: 14, percentage: 2, icon: ClaudeIcon },
//     { name: "DuckDuckGo", count: 7, percentage: 1, icon: DuckDuckGoIcon },
// ];

// const TABS = ["AI Answers", "Indexing", "Training"] as const;
// type Tab = (typeof TABS)[number];

// export default function BotFilteringCard() {
//     const [activeTab, setActiveTab] = useState<Tab>("AI Answers");

//     const barListData = BOT_FILTERING_ANALYTICS.map((item) => ({
//         name: item.name,
//         value: item.count,
//         percentage: item.percentage,
//         icon: item.icon,
//     }));

//     return (
//         <div className="bg-bg-card border border-border-subtle rounded-2xl h-[450px] flex flex-col">
//             <div className="flex border-b border-border-subtle">
//                 {TABS.map((tab) => (
//                     <button
//                         key={tab}
//                         onClick={() => setActiveTab(tab)}
//                         aria-selected={activeTab === tab}
//                         className={`px-6 py-3 font-display text-[15px] font-medium transition-colors ${activeTab === tab
//                             ? "text-content-default border-b-2 border-content-default -mb-px"
//                             : "text-content-subtle hover:text-content-default"
//                             }`}
//                     >
//                         {tab}
//                     </button>
//                 ))}
//             </div>

//             <div className="flex flex-1 min-h-0">
//                 <div className="w-3/4 h-full p-4 overflow-hidden">
//                     <BotFilteringAreaChart demo />
//                 </div>

//                 <div className="w-1/4 h-full border-l border-border-subtle p-2 overflow-y-auto">
//                     <div className="space-y-4">
//                         {BOT_FILTERING_ANALYTICS.map((bot) => {
//                             const Icon = bot.icon;

//                             return (
//                                 <div
//                                     key={bot.name}
//                                     className="group flex items-center justify-between rounded-none bg-bg-bar-primary px-2 py-1.5 mb-2"
//                                 >
//                                     <div className="flex items-center gap-2 min-w-0">
//                                         <span className="flex items-center justify-center size-5 shrink-0">
//                                             <Icon className="size-5" />
//                                         </span>

//                                         <span className="truncate font-display text-sm text-content-default">
//                                             {bot.name}
//                                         </span>
//                                     </div>

//                                     <div className="flex items-center gap-2">
//                                         <span className="text-[13.5px] font-alexandria text-content-default">
//                                             {bot.count}
//                                         </span>

//                                         <span className="hidden group-hover:block font-alexandria text-xs text-content-subtle">
//                                             {bot.percentage}%
//                                         </span>
//                                     </div>
//                                 </div>
//                             );
//                         })}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

// "use client";

// import { useContext, useMemo, useState } from "react";
// import useSWR from "swr";
// import { fetcher } from "@repo/utils";
// import { AnalyticsContext } from "./analytics-providers";
// import { editQueryString } from "@/lib/analytics/utils";
// import { BotFilteringAreaChart } from "./bot-filtering-chart";
// import { getVendorIcon, getVendorLabel } from "@/lib/bot/bot-vendor-icons";

// type ProviderRow = {
//   vendor: string;
//   category: string;
//   requests: number;
//   percentage: number;
// };

// const TABS = ["AI Answers", "Indexing", "Training"] as const;
// type Tab = (typeof TABS)[number];

// const TAB_TO_CATEGORY: Record<Tab, string> = {
//   "AI Answers": "answer_agent",
//   Indexing: "index_crawler",
//   Training: "training_crawler",
// };

// export default function BotFilteringCard() {
//   const [activeTab, setActiveTab] = useState<Tab>("AI Answers");
//   const { baseApiPath, queryString, interval, start, end } = useContext(AnalyticsContext);

//   const category = TAB_TO_CATEGORY[activeTab];

//   const { data: response, isLoading } = useSWR<{ data: ProviderRow[] }>(
//     baseApiPath &&
//       `${baseApiPath}?${editQueryString(queryString, {
//         groupBy: "providers",
//         event: "bot_filtering",
//         category,
//       })}`,
//     fetcher
//   );

//   const providers = useMemo(() => {
//     if (!response?.data) return [];
//     return [...response.data].sort((a, b) => b.requests - a.requests);
//   }, [response]);

//   const hasData = providers.length > 0;

//   return (
//     <div className="bg-bg-card border border-border-subtle rounded-2xl h-[450px] flex flex-col">
//       <div className="flex border-b border-border-subtle">
//         {TABS.map((tab) => (
//           <button
//             key={tab}
//             onClick={() => setActiveTab(tab)}
//             aria-selected={activeTab === tab}
//             className={`px-6 py-3 font-display text-[15px] font-medium transition-colors ${
//               activeTab === tab
//                 ? "text-content-default border-b-2 border-content-default -mb-px"
//                 : "text-content-subtle hover:text-content-default"
//             }`}
//           >
//             {tab}
//           </button>
//         ))}
//       </div>

//       <div className="flex flex-1 min-h-0">
//         <div className="w-3/4 h-full p-4 overflow-hidden">
//           <BotFilteringAreaChart category={category} />
//         </div>

//         <div className="w-1/4 h-full border-l border-border-subtle p-2 overflow-y-auto">
//           {isLoading && !response ? (
//             <div className="flex h-full items-center justify-center">
//               <span className="text-xs text-content-subtle font-alexandria">Loading…</span>
//             </div>
//           ) : hasData ? (
//             <div className="space-y-4">
//               {providers.map((bot) => {
//                 const Icon = getVendorIcon(bot.vendor);
//                 return (
//                   <div
//                     key={bot.vendor}
//                     className="group flex items-center justify-between rounded-none bg-bg-bar-primary px-2 py-1.5 mb-2"
//                   >
//                     <div className="flex items-center gap-2 min-w-0">
//                       <span className="flex items-center justify-center size-5 shrink-0">
//                         <Icon className="size-5" />
//                       </span>
//                       <span className="truncate font-display text-sm text-content-default">
//                         {getVendorLabel(bot.vendor)}
//                       </span>
//                     </div>

//                     <div className="flex items-center gap-2">
//                       <span className="text-[13.5px] font-alexandria text-content-default">
//                         {bot.requests}
//                       </span>
//                       <span className="hidden group-hover:block font-alexandria text-xs text-content-subtle">
//                         {bot.percentage}%
//                       </span>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           ) : (
//             <div className="flex h-full items-center justify-center text-center px-2">
//               <p className="text-xs font-alexandria text-content-subtle">
//                 No bot traffic recorded yet for this category.
//               </p>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";

import { useContext, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { fetcher, nFormatter } from "@repo/utils";
import { AnalyticsContext } from "./analytics-providers";
import { editQueryString, toBotFilteringApiPath } from "@/lib/analytics/utils";
import { BotFilteringAreaChart } from "./bot-filtering-chart";
import { getVendorIcon, getVendorLabel } from "@/lib/bot/bot-vendor-icons";

type CrawlerRow = {
  vendor: string;
  agent_name: string;
  category: string;
  requests: number;
  verified_requests: number;
  spoofed_requests: number;
  last_seen: string;
};

type ProviderSummary = {
  vendor: string;
  requests: number;
  verified: number;
  spoofed: number;
  agents: CrawlerRow[];
};

type RequestRow = {
  timestamp: string;
  agent_name: string;
  hostname: string;
  page: string;
  status_code: number | null;
  verification: string;
  match_type: string;
  authenticated: number;
};

// How the classifier recognised the User-Agent; "exact" is the norm and
// left unlabelled. Fallback = unregistered agent from a known vendor.
const MATCH_TYPE_LABELS: Record<string, string> = {
  fallback: "Vendor match",
  generic: "Generic bot",
};

// Server-side crawler identity check recorded at ingest (see apps/ingestion
// crawler-verification.ts): IP ranges / reverse DNS published by the vendor.
const VERIFICATION_LABELS: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "text-emerald-600 dark:text-emerald-400" },
  spoofed: { label: "Spoofed", className: "text-red-600 dark:text-red-400" },
  unverifiable: { label: "Unverifiable", className: "text-content-subtle" },
  unknown: { label: "No IP", className: "text-content-subtle" },
};

// Events sent with only the public project ID report the crawler IP
// themselves, so an IP match proves less than for token-signed events.
const UNAUTHENTICATED_VERIFIED = {
  label: "IP match",
  className: "text-content-subtle",
  title: "The reported IP is in the crawler vendor's ranges, but this event was sent without your bot token.",
};

function requestBadge(request: RequestRow): { label: string; className: string; title?: string } {
  if (request.verification === "verified" && !request.authenticated) return UNAUTHENTICATED_VERIFIED;
  return VERIFICATION_LABELS[request.verification] ?? VERIFICATION_LABELS.unknown;
}

function FilterToggle({
  pressed,
  onToggle,
  title,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={pressed}
      title={title}
      className={`shrink-0 rounded-full border px-2.5 py-1 font-alexandria text-[12px] transition-colors ${pressed
          ? "border-content-default text-content-default"
          : "border-border-subtle text-content-subtle hover:text-content-default"
        }`}
    >
      {children}
    </button>
  );
}

const TABS = ["AI Answers", "Indexing", "Training", "Other"] as const;
// const TABS = ["AI Answers"] as const;
// const TABS = [ "Training"] as const;


type Tab = (typeof TABS)[number];

// Mirrors the server-side categories from @convrs/ai-bot-sdk's classifier;
// "Other" also holds unregistered automation (agent_name "unknown_bot").
const TAB_TO_CATEGORY: Record<Tab, string> = {
  "AI Answers": "answer_agent",
  Indexing: "index_crawler",
  Training: "training_crawler",
  Other: "other",
};

export default function BotFilteringCard() {
  const [activeTab, setActiveTab] = useState<Tab>("AI Answers");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [authenticatedOnly, setAuthenticatedOnly] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const { baseApiPath, queryString } = useContext(AnalyticsContext);

  const category = TAB_TO_CATEGORY[activeTab];
  const filters = {
    ...(verifiedOnly && { verification: "verified" }),
    ...(authenticatedOnly && { authenticated: "true" }),
  };
  const botApiPath = useMemo(() => toBotFilteringApiPath(baseApiPath), [baseApiPath]);

  // Agent-level rows (vendor + agent + verified/spoofed counts), rolled up
  // per provider for the list and shown as-is in the provider drill-down.
  const { data: response, isLoading } = useSWR<{ data: CrawlerRow[] }>(
    botApiPath &&
    `${botApiPath}?${editQueryString(queryString, {
      groupBy: "crawlers",
      category,
      ...filters,
    })}`,
    fetcher
  );

  const providers = useMemo<ProviderSummary[]>(() => {
    if (!Array.isArray(response?.data)) return [];
    const byVendor = new Map<string, ProviderSummary>();
    for (const row of response.data) {
      const summary = byVendor.get(row.vendor) ?? {
        vendor: row.vendor,
        requests: 0,
        verified: 0,
        spoofed: 0,
        agents: [],
      };
      summary.requests += row.requests;
      summary.verified += row.verified_requests;
      summary.spoofed += row.spoofed_requests;
      summary.agents.push(row);
      byVendor.set(row.vendor, summary);
    }
    return Array.from(byVendor.values()).sort((a, b) => b.requests - a.requests);
  }, [response]);

  const total = providers.reduce((sum, p) => sum + p.requests, 0);
  const selected = providers.find((p) => p.vendor === selectedVendor) ?? null;
  const hasData = providers.length > 0;

  return (
    <div className="bg-bg-card border border-border-subtle rounded-2xl h-auto sm:h-[450px] flex flex-col">
      <div className="flex items-center border-b border-border-subtle">
        <div className="flex min-w-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedVendor(null);
              }}
              aria-selected={activeTab === tab}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 sm:px-6 font-display text-[15px] font-medium transition-colors ${activeTab === tab
                  ? "text-content-default border-b-2 border-content-default "
                  : "text-content-subtle hover:text-content-default"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ml-auto mr-3 flex shrink-0 gap-1.5">
          <FilterToggle
            pressed={verifiedOnly}
            onToggle={() => setVerifiedOnly((v) => !v)}
            title="Only count requests whose IP matches the crawler vendor's published ranges or reverse DNS"
          >
            Verified only
          </FilterToggle>
          <FilterToggle
            pressed={authenticatedOnly}
            onToggle={() => setAuthenticatedOnly((v) => !v)}
            title="Only count requests sent with your website's bot token (Settings → Script → Bot traffic)"
          >
            Authenticated only
          </FilterToggle>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <div className="w-full sm:w-2/3 h-[260px] sm:h-full p-4 overflow-hidden">
          <BotFilteringAreaChart category={category} filters={filters} />
        </div>

        <div className="w-full sm:w-1/3 max-h-[320px] sm:max-h-none sm:h-full border-t sm:border-t-0 sm:border-l border-border-subtle p-2 overflow-y-auto">
          {isLoading && !response ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-content-subtle font-alexandria">Loading…</span>
            </div>
          ) : selected ? (
            <ProviderDetail
              provider={selected}
              botApiPath={botApiPath}
              queryString={queryString}
              category={category}
              filters={filters}
              onBack={() => setSelectedVendor(null)}
            />
          ) : hasData ? (
            <div className="space-y-2">
              {providers.map((bot) => {
                const Icon = getVendorIcon(bot.vendor);
                const percentage = total > 0 ? Math.round((bot.requests / total) * 100) : 0;
                return (
                  <button
                    key={bot.vendor}
                    onClick={() => setSelectedVendor(bot.vendor)}
                    className="group flex w-full items-center justify-between rounded-none bg-bg-bar-primary px-2 py-1.5 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex items-center justify-center size-5 shrink-0">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm text-content-default">
                          {getVendorLabel(bot.vendor)}
                        </span>
                        <VerificationSummary verified={bot.verified} spoofed={bot.spoofed} />
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-alexandria text-content-default">
                        {nFormatter(bot.requests)}
                      </span>
                      <span className="hidden group-hover:block font-alexandria text-xs text-content-subtle">
                        {percentage}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center px-2">
              <p className="text-[12.5px] font-alexandria text-content-subtle">
                {verifiedOnly || authenticatedOnly
                  ? "No crawler requests match these filters yet."
                  : "No known crawler has requested your server-rendered pages yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerificationSummary({ verified, spoofed }: { verified: number; spoofed: number }) {
  if (!verified && !spoofed) return null;
  return (
    <span className="block font-alexandria text-[11px] text-content-subtle">
      {verified > 0 && <span className={VERIFICATION_LABELS.verified.className}>{nFormatter(verified)} verified</span>}
      {verified > 0 && spoofed > 0 && " · "}
      {spoofed > 0 && <span className={VERIFICATION_LABELS.spoofed.className}>{nFormatter(spoofed)} spoofed</span>}
    </span>
  );
}

function ProviderDetail({
  provider,
  botApiPath,
  queryString,
  category,
  filters,
  onBack,
}: {
  provider: ProviderSummary;
  botApiPath: string | undefined;
  queryString: string;
  category: string;
  filters: Record<string, string>;
  onBack: () => void;
}) {
  const { data: response, isLoading } = useSWR<{ data: RequestRow[] }>(
    botApiPath &&
    `${botApiPath}?${editQueryString(queryString, {
      groupBy: "requests",
      category,
      vendor: provider.vendor,
      limit: "25",
      ...filters,
    })}`,
    fetcher
  );
  const requests = Array.isArray(response?.data) ? response.data : [];
  const Icon = getVendorIcon(provider.vendor);

  return (
    <div className="space-y-3 font-alexandria">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[12.5px] text-content-subtle hover:text-content-default"
      >
        ← All providers
      </button>

      <div className="flex items-center gap-2">
        <Icon className="size-5 shrink-0" />
        <span className="font-display text-sm font-medium text-content-default">
          {getVendorLabel(provider.vendor)}
        </span>
        <span className="ml-auto text-[13px] text-content-default">{nFormatter(provider.requests)}</span>
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-content-subtle">Agents</p>
        <div className="space-y-1">
          {provider.agents.map((agent) => (
            <div key={agent.agent_name} className="flex items-center justify-between bg-bg-bar-primary px-2 py-1">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-content-default">
                  {agent.agent_name === "unknown_bot" ? "Unknown bot" : agent.agent_name}
                </span>
                <VerificationSummary verified={agent.verified_requests} spoofed={agent.spoofed_requests} />
              </span>
              <span className="text-[12.5px] text-content-default">{nFormatter(agent.requests)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-content-subtle">Recent requests</p>
        {isLoading && !response ? (
          <p className="text-[12px] text-content-subtle">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-[12px] text-content-subtle">No requests in this range.</p>
        ) : (
          <div className="space-y-1">
            {requests.map((request, index) => {
              const badge = requestBadge(request);
              return (
                <div key={`${request.timestamp}-${index}`} className="bg-bg-bar-primary px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] text-content-default" title={`${request.hostname}${request.page}`}>
                      {request.page}
                    </span>
                    <StatusCode code={request.status_code} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-content-subtle">
                    <span className="truncate">
                      {request.agent_name === "unknown_bot" ? "Unknown bot" : request.agent_name}
                      {MATCH_TYPE_LABELS[request.match_type] && ` · ${MATCH_TYPE_LABELS[request.match_type]}`}
                    </span>
                    <span className={badge.className} title={badge.title}>{badge.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCode({ code }: { code: number | null }) {
  if (code == null) return <span className="text-[11px] text-content-subtle">—</span>;
  const className =
    code >= 500
      ? "text-red-600 dark:text-red-400"
      : code >= 400
        ? "text-amber-600 dark:text-amber-400"
        : code >= 300
          ? "text-content-subtle"
          : "text-emerald-600 dark:text-emerald-400";
  return <span className={`shrink-0 text-[11.5px] ${className}`}>{code}</span>;
}