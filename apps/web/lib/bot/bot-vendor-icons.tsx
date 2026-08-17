// import { ChatGptIcon, GeminiIcon, ClaudeIcon, DuckDuckGoIcon } from "@/ui/icons/ai";
// import { Bot } from "lucide-react";
// import type { ComponentType } from "react";

// /**
//  * Maps a vendor name (as returned by the API, e.g. "OpenAI", "Anthropic") to
//  * an icon component. Falls back to a generic bot icon for any vendor that
//  * doesn't have a dedicated icon yet — new vendors in the SDK's registry will
//  * render immediately instead of silently disappearing from the UI.
//  */
// const VENDOR_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
//   openai: ChatGptIcon,
//   google: GeminiIcon,
//   anthropic: ClaudeIcon,
//   duckduckgo: DuckDuckGoIcon,
// };

// const VENDOR_LABEL_OVERRIDES: Record<string, string> = {
//   openai: "ChatGPT",
//   google: "Gemini",
//   anthropic: "Claude",
//   duckduckgo: "DuckDuckGo",
// };

// export function getVendorIcon(vendor: string): ComponentType<{ className?: string }> {
//   return VENDOR_ICON_MAP[vendor.toLowerCase()] ?? Bot;
// }

// export function getVendorLabel(vendor: string): string {
//   return VENDOR_LABEL_OVERRIDES[vendor.toLowerCase()] ?? vendor;
// }

// export function normalizeVendorKey(vendor: string): string {
//   return vendor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
// }

import { ChatGptIcon, GeminiIcon, ClaudeIcon, DuckDuckGoIcon } from "@/ui/icons/ai";
import { Bot } from "lucide-react";
import type { ComponentType } from "react";

const VENDOR_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  openai: ChatGptIcon,
  google: GeminiIcon,
  anthropic: ClaudeIcon,
  duckduckgo: DuckDuckGoIcon,
};

const VENDOR_LABEL_OVERRIDES: Record<string, string> = {
  openai: "ChatGPT",
  google: "Gemini",
  anthropic: "Claude",
  duckduckgo: "DuckDuckGo",
};

// Colors are pinned to vendor IDENTITY, not to rank/position in the data.
// If colors were assigned by sorted position (e.g. "first vendor by request
// count gets green"), the same vendor would change color day to day as
// whichever bot happens to have the most traffic shifts — that's the bug
// that made Claude render blue in the screenshot instead of its own orange.
const VENDOR_COLOR_MAP: Record<string, string> = {
  openai: "text-[#10A37F]",
  google: "text-[#3186FF]",
  anthropic: "text-[#D97757]",
  duckduckgo: "text-[#DE5833]",
};

// Fallback palette for vendors without a dedicated color, cycled by a stable
// hash of the vendor key so a given unknown vendor always lands on the same
// color across renders instead of shifting with the data.
const FALLBACK_COLORS = [
  "text-[#8B5CF6]",
  "text-[#F59E0B]",
  "text-[#EC4899]",
  "text-[#14B8A6]",
  "text-[#F97316]",
  "text-[#06B6D4]",
];

export function getVendorIcon(vendor: string): ComponentType<{ className?: string }> {
  return VENDOR_ICON_MAP[vendor.toLowerCase()] ?? Bot;
}

export function getVendorLabel(vendor: string): string {
  return VENDOR_LABEL_OVERRIDES[vendor.toLowerCase()] ?? vendor;
}

export function getVendorColor(vendor: string): string {
  const key = normalizeVendorKey(vendor);
  if (VENDOR_COLOR_MAP[key]) return VENDOR_COLOR_MAP[key];
  return FALLBACK_COLORS[stableHash(key) % FALLBACK_COLORS.length];
}

export function normalizeVendorKey(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}