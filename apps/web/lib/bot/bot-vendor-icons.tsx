import { ChatGptIcon, GeminiIcon, ClaudeIcon, DuckDuckGoIcon } from "@/ui/icons/ai";
import { Bot } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Maps a vendor name (as returned by the API, e.g. "OpenAI", "Anthropic") to
 * an icon component. Falls back to a generic bot icon for any vendor that
 * doesn't have a dedicated icon yet — new vendors in the SDK's registry will
 * render immediately instead of silently disappearing from the UI.
 */
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

export function getVendorIcon(vendor: string): ComponentType<{ className?: string }> {
  return VENDOR_ICON_MAP[vendor.toLowerCase()] ?? Bot;
}

export function getVendorLabel(vendor: string): string {
  return VENDOR_LABEL_OVERRIDES[vendor.toLowerCase()] ?? vendor;
}

export function normalizeVendorKey(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}
