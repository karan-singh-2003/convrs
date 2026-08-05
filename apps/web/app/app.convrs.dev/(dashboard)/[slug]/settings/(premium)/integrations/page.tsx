// "use client";

// import { useState } from "react";
// import { useParams } from "next/navigation";
// import useSWR, { mutate } from "swr";
// import { fetcher } from "@repo/utils";
// import { toast } from "sonner";

// type Keyword = { id: string; term: string; isActive: boolean };
// type AttributionHandle = { id: string; platform: "x" | "reddit"; handle: string };

// const TABS = ["Mentions", "Link attribution"] as const;
// type Tab = (typeof TABS)[number];

// export default function SocialIntegrationSettingsCard() {
//   const { slug } = useParams() as { slug: string };
//   const [activeTab, setActiveTab] = useState<Tab>("Mentions");
//   const [keywordInput, setKeywordInput] = useState("");
//   const [handleInput, setHandleInput] = useState("");

//   const { data: keywordsData } = useSWR<{ data: Keyword[] }>(
//     `/api/${slug}/social/keywords`,
//     fetcher
//   );
//   const { data: handlesData } = useSWR<{ data: AttributionHandle[] }>(
//     `/api/${slug}/social/attribution-handles`,
//     fetcher
//   );

//   const keywords = keywordsData?.data ?? [];
//   const handles = handlesData?.data ?? [];

//   async function addKeyword() {
//     const term = keywordInput.trim();
//     if (term.length < 4 || term.length > 15) {
//       toast.error("Keywords must be 4-15 characters");
//       return;
//     }

//     const res = await fetch(`/api/${slug}/social/keywords`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ term }),
//     });

//     if (!res.ok) {
//       const body = await res.json().catch(() => ({}));
//       toast.error(body.error ?? "Failed to add keyword");
//       return;
//     }

//     setKeywordInput("");
//     mutate(`/api/${slug}/social/keywords`);
//     toast.success(`Now tracking "${term}"`);
//   }

//   async function removeKeyword(id: string) {
//     await fetch(`/api/${slug}/social/keywords/${id}`, { method: "DELETE" });
//     mutate(`/api/${slug}/social/keywords`);
//   }

//   async function addHandle() {
//     const handle = handleInput.trim().replace(/^@/, "");
//     if (!handle) return;

//     const res = await fetch(`/api/${slug}/social/attribution-handles`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ handle, platform: "x" }),
//     });

//     if (!res.ok) {
//       const body = await res.json().catch(() => ({}));
//       toast.error(body.error ?? "Failed to add handle");
//       return;
//     }

//     setHandleInput("");
//     mutate(`/api/${slug}/social/attribution-handles`);
//     toast.success(`Added @${handle} to link attribution`);
//   }

//   async function removeHandle(id: string) {
//     await fetch(`/api/${slug}/social/attribution-handles/${id}`, { method: "DELETE" });
//     mutate(`/api/${slug}/social/attribution-handles`);
//   }

//   return (
//     <div className="bg-bg-card border border-border-subtle rounded-2xl">
//       <div className="px-5 py-4 border-b border-border-subtle">
//         <h3 className="font-display font-medium text-[15px] text-content-default">
//           Twitter / X
//         </h3>
//         <p className="text-[13px] font-display text-content-subtle mt-1">
//           Track mentions and attribute traffic to the tweets and accounts driving it.
//         </p>
//       </div>

//       <div className="flex border-b border-border-subtle px-5">
//         {TABS.map((tab) => (
//           <button
//             key={tab}
//             onClick={() => setActiveTab(tab)}
//             className={`px-4 py-2.5 font-display text-[14px] font-medium transition-colors ${
//               activeTab === tab
//                 ? "text-content-default border-b-2 border-content-default -mb-px"
//                 : "text-content-subtle hover:text-content-default"
//             }`}
//           >
//             {tab}
//           </button>
//         ))}
//       </div>

//       <div className="p-5 space-y-4">
//         {activeTab === "Mentions" && (
//           <>
//             <p className="text-[13px] font-display text-content-subtle">
//               Add brand names, product names, or campaign hashtags. Your domain is
//               tracked automatically on both X and Reddit — no need to add it here.
//               4–15 characters, case insensitive.
//             </p>

//             <div className="flex gap-2">
//               <input
//                 value={keywordInput}
//                 onChange={(e) => setKeywordInput(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && addKeyword()}
//                 placeholder="e.g. Convrs, @convrsdev, #convrs"
//                 className="flex-1 h-9 rounded-lg border focus:ring-0 focus:outline-0 focus:border-border-default border-border-subtle bg-bg-default px-3 text-[13.5px] font-display text-content-default placeholder:text-content-subtle focus:outline-none"
//               />
//               <button
//                 onClick={addKeyword}
//                 className="h-9 px-4 rounded-lg bg-bg-inverted text-content-inverted text-[13.5px] font-display font-medium"
//               >
//                 Add
//               </button>
//             </div>

//             <div className="space-y-2">
//               {keywords.map((keyword) => (
//                 <div
//                   key={keyword.id}
//                   className="flex items-center justify-between rounded-lg bg-bg-subtle px-3 py-2"
//                 >
//                   <span className="text-[13.5px] font-display text-content-default">
//                     {keyword.term}
//                   </span>
//                   <button
//                     onClick={() => removeKeyword(keyword.id)}
//                     className="text-[12px] font-display text-content-subtle hover:text-content-default"
//                   >
//                     Remove
//                   </button>
//                 </div>
//               ))}
//               {keywords.length === 0 && (
//                 <p className="text-[13px] font-display text-content-subtle py-2">
//                   No keywords tracked yet.
//                 </p>
//               )}
//             </div>
//           </>
//         )}

//         {activeTab === "Link attribution" && (
//           <>
//             <p className="text-[13px] font-display text-content-subtle">
//               Only add accounts that actually have your website link somewhere in
//               their profile — your own account, or an affiliate account. Traffic
//               from their profile page will be attributed directly to them.
//             </p>

//             <div className="flex gap-2">
//               <input
//                 value={handleInput}
//                 onChange={(e) => setHandleInput(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && addHandle()}
//                 placeholder="e.g. @levelsio"
//                 className="flex-1 h-9 rounded-lg border border-border-subtle bg-bg-default px-3 text-[13.5px] font-display text-content-default placeholder:text-content-subtle focus:outline-none"
//               />
//               <button
//                 onClick={addHandle}
//                 className="h-9 px-4 rounded-lg bg-bg-inverted text-content-inverted text-[13.5px] font-display font-medium"
//               >
//                 Add
//               </button>
//             </div>

//             <div className="space-y-2">
//               {handles.map((h) => (
//                 <div
//                   key={h.id}
//                   className="flex items-center justify-between rounded-lg bg-bg-subtle px-3 py-2"
//                 >
//                   <span className="text-[13.5px] font-display text-content-default">
//                     @{h.handle} <span className="text-content-subtle uppercase text-[11px]">{h.platform}</span>
//                   </span>
//                   <button
//                     onClick={() => removeHandle(h.id)}
//                     className="text-[12px] font-display text-content-subtle hover:text-content-default"
//                   >
//                     Remove
//                   </button>
//                 </div>
//               ))}
//               {handles.length === 0 && (
//                 <p className="text-[13px] font-display text-content-subtle py-2">
//                   No link-in-bio accounts added yet.
//                 </p>
//               )}
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { fetcher } from "@repo/utils";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";
import {useRouter} from "next/navigation";

type Keyword = { id: string; term: string; isActive: boolean };
type AttributionHandle = { id: string; platform: "x" | "reddit"; handle: string };
type IntegrationStatus = { x: boolean; reddit: boolean };

const TABS = ["Mentions", "Link attribution"] as const;
type Tab = (typeof TABS)[number];

export default function SocialIntegrationSettingsCard() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Mentions");
  const [keywordInput, setKeywordInput] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const { planFamily } = useWorkspace()

  const { data: integrationsData } = useSWR<{ data: IntegrationStatus }>(
    `/api/workspaces/${slug}/social/integrations`,
    fetcher
  );
  const { data: keywordsData } = useSWR<{ data: Keyword[] }>(
    `/api/workspaces/${slug}/social/keywords`,
    fetcher
  );
  const { data: handlesData } = useSWR<{ data: AttributionHandle[] }>(
    `/api/workspaces/${slug}/social/attribution-handles`,
    fetcher
  );

  const isXConnected = integrationsData?.data.x ?? false;
  const keywords = keywordsData?.data ?? [];
  const handles = handlesData?.data ?? [];

  async function addKeyword() {
    const term = keywordInput.trim();
    if (term.length < 4 || term.length > 15) {
      toast.error("Keywords must be 4-15 characters");
      return;
    }

    const res = await fetch(`/api/workspaces/${slug}/social/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to add keyword");
      return;
    }

    setKeywordInput("");
    mutate(`/api/workspaces/${slug}/social/keywords`);
    toast.success(`Now tracking "${term}"`);
  }

  async function removeKeyword(id: string) {
    await fetch(`/api/workspaces/${slug}/social/keywords/${id}`, { method: "DELETE" });
    mutate(`/api/workspaces/${slug}/social/keywords`);
  }

  async function addHandle() {
    const handle = handleInput.trim().replace(/^@/, "");
    if (!handle) return;

    const res = await fetch(`/api/workspaces/${slug}/social/attribution-handles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, platform: "x" }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to add handle");
      return;
    }

    setHandleInput("");
    mutate(`/api/workspaces/${slug}/social/attribution-handles`);
    toast.success(`Added @${handle} to link attribution`);
  }

  async function removeHandle(id: string) {
    await fetch(`/api/workspaces/${slug}/social/attribution-handles/${id}`, { method: "DELETE" });
    mutate(`/api/workspaces/${slug}/social/attribution-handles`);
  }
  if (planFamily !== "growth") {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-4 justify-between">
            <div>
              <h3 className="font-display text-[15px] font-medium text-content-default">
                Twitter / X
              </h3>

              <p className="mt-1 text-[13px] font-display text-content-subtle">
                Connect your X account to monitor mentions, discover conversations,
                and attribute traffic from social media.
              </p>
            </div>

            {/* <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium font-display text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Growth
            </span> */}
          </div>
        </div>

        <div className="p-8">
          <div className="mx-auto max-w-lg text-center">
            <button
              className="mt-0 inline-flex h-10 items-center justify-center rounded-lg bg-bg-inverted px-5 text-[13.5px] font-display font-medium text-content-inverted transition hover:opacity-90"
              onClick={() => {
                router.push(`/${slug}/settings/billing`)
              }}
            >
              Upgrade to Growth
            </button>

            <p className="mt-3 text-[13px] font-display text-content-subtle">
              Unlock X monitoring and every other Growth feature.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-bg-card border border-border-subtle rounded-2xl">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-medium text-[15px] text-content-default">
            Twitter / X
          </h3>

          {/* Connection status — read-only indicator, no connect flow here.
              A workspace's SocialIntegration row is created out-of-band
              (currently: manually, until a real connect flow exists). */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-display font-medium ${isXConnected
              ? "bg-bg-success text-content-success"
              : "bg-bg-subtle text-content-subtle"
              }`}
          >
            <span
              className={`size-1.5 rounded-full ${isXConnected ? "bg-content-success" : "bg-content-subtle"
                }`}
            />
            {isXConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        <p className="text-[13px] font-display text-content-subtle mt-1">
          {isXConnected
            ? "Track mentions and attribute traffic to the tweets and accounts driving it."
            : "Connect your X account to start tracking mentions and link attribution."}
        </p>
      </div>

      <div className="flex border-b border-border-subtle px-5">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 font-display text-[14px] font-medium transition-colors ${activeTab === tab
              ? "text-content-default border-b-2 border-content-default -mb-px"
              : "text-content-subtle hover:text-content-default"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {!isXConnected && (
          <div className="rounded-lg bg-bg-subtle px-3 py-2.5 text-[13px] font-display text-content-subtle">
            X isn't connected yet — keywords and link attribution accounts can
            still be added below, but tracking won't start until X is connected.
          </div>
        )}

        {activeTab === "Mentions" && (
          <>
            <p className="text-[13px] font-display text-content-subtle">
              Add brand names, product names, or campaign hashtags. Your domain is
              tracked automatically on both X and Reddit — no need to add it here.
              4–15 characters, case insensitive.
            </p>

            <div className="flex gap-2">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder="e.g. Convrs, @convrsdev, #convrs"
                className="flex-1 h-9 rounded-lg border focus:ring-0 focus:outline-0 focus:border-border-default border-border-subtle bg-bg-default px-3 text-[13.5px] font-display text-content-default placeholder:text-content-subtle focus:outline-none"
              />
              <button
                onClick={addKeyword}
                className="h-9 px-4 rounded-lg bg-bg-inverted text-content-inverted text-[13.5px] font-display font-medium"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="flex items-center justify-between rounded-lg bg-bg-subtle px-3 py-2"
                >
                  <span className="text-[13.5px] font-display text-content-default">
                    {keyword.term}
                  </span>
                  <button
                    onClick={() => removeKeyword(keyword.id)}
                    className="text-[12px] font-display text-content-subtle hover:text-content-default"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {keywords.length === 0 && (
                <p className="text-[13px] font-display text-content-subtle py-2">
                  No keywords tracked yet.
                </p>
              )}
            </div>
          </>
        )}

        {activeTab === "Link attribution" && (
          <>
            <p className="text-[13px] font-display text-content-subtle">
              Only add accounts that actually have your website link somewhere in
              their profile — your own account, or an affiliate account. Traffic
              from their profile page will be attributed directly to them.
            </p>

            <div className="flex gap-2">
              <input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHandle()}
                placeholder="e.g. @levelsio"
                className="flex-1 h-9 rounded-lg border border-border-subtle bg-bg-default px-3 text-[13.5px] font-display text-content-default placeholder:text-content-subtle focus:outline-none"
              />
              <button
                onClick={addHandle}
                className="h-9 px-4 rounded-lg bg-bg-inverted text-content-inverted text-[13.5px] font-display font-medium"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {handles.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg bg-bg-subtle px-3 py-2"
                >
                  <span className="text-[13.5px] font-display text-content-default">
                    @{h.handle} <span className="text-content-subtle uppercase text-[11px]">{h.platform}</span>
                  </span>
                  <button
                    onClick={() => removeHandle(h.id)}
                    className="text-[12px] font-display text-content-subtle hover:text-content-default"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {handles.length === 0 && (
                <p className="text-[13px] font-display text-content-subtle py-2">
                  No link-in-bio accounts added yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}