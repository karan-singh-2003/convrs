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

import { useContext, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { AnalyticsContext } from "./analytics-providers";
import { editQueryString, toBotFilteringApiPath } from "@/lib/analytics/utils";
import { BotFilteringAreaChart } from "./bot-filtering-chart";
import { getVendorIcon, getVendorLabel } from "@/lib/bot/bot-vendor-icons";

type ProviderRow = {
  vendor: string;
  category: string;
  requests: number;
  percentage: number;
};

const TABS = ["AI Answers", "Indexing", "Training"] as const;
// const TABS = ["AI Answers"] as const;
// const TABS = [ "Training"] as const;


type Tab = (typeof TABS)[number];

const TAB_TO_CATEGORY: Record<Tab, string> = {
  "AI Answers": "answer_agent",
  Indexing: "index_crawler",
  Training: "training_crawler",
};

export default function BotFilteringCard() {
  const [activeTab, setActiveTab] = useState<Tab>("Training");
  const { baseApiPath, queryString, interval, start, end } = useContext(AnalyticsContext);

  const category = TAB_TO_CATEGORY[activeTab];
  const botApiPath = useMemo(() => toBotFilteringApiPath(baseApiPath), [baseApiPath]);

  const { data: response, isLoading } = useSWR<{ data: ProviderRow[] }>(
    botApiPath &&
    `${botApiPath}?${editQueryString(queryString, {
      groupBy: "providers",
      category,
    })}`,
    fetcher
  );



  const providers = useMemo(() => {
    if (!response?.data) return [];
    return [...response.data].sort((a, b) => b.requests - a.requests);
  }, [response]);

  const hasData = providers.length > 0;

  return (
    <div className="bg-bg-card border border-border-subtle rounded-2xl h-[450px] flex flex-col">
      <div className="flex border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            className={`px-6 py-3 font-display text-[15px] font-medium transition-colors ${activeTab === tab
                ? "text-content-default border-b-2 border-content-default -mb-px"
                : "text-content-subtle hover:text-content-default"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-2/3 h-full p-4 overflow-hidden">
          <BotFilteringAreaChart category={category} />
        </div>

        <div className="w-1/3 h-full border-l border-border-subtle p-2 overflow-y-auto">
          {isLoading && !response ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-content-subtle font-alexandria">Loading…</span>
            </div>
          ) : hasData ? (
            <div className="space-y-4">
              {providers.map((bot) => {
                const Icon = getVendorIcon(bot.vendor);
                return (
                  <div
                    key={bot.vendor}
                    className="group flex items-center justify-between rounded-none bg-bg-bar-primary px-2 py-1.5 mb-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex items-center justify-center size-5 shrink-0">
                        <Icon className="size-5" />
                      </span>
                      <span className="truncate font-display text-sm text-content-default">
                        {getVendorLabel(bot.vendor)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-alexandria text-content-default">
                        {bot.requests}
                      </span>
                      <span className="hidden group-hover:block font-alexandria text-xs text-content-subtle">
                        {bot.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center px-2">
              <p className="text-[12.5px] font-alexandria text-content-subtle">
                No bot traffic recorded yet for this category.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}