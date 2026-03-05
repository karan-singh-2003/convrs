"use client";

import { useState, type ComponentType } from "react";
import { cn } from "@repo/utils";
import { Google, Github, XLogo, Youtube, Reddit, ProductHunt } from "@repo/ui";

const SOURCES: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }> | null;
}[] = [
  { id: "x", label: "X", icon: XLogo },
  { id: "google", label: "Google", icon: Google },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "reddit", label: "Reddit", icon: Reddit },
  { id: "producthunt", label: "Product\nHunt", icon: ProductHunt },
  { id: "github", label: "GitHub", icon: Github },
  { id: "other", label: "Other", icon: null },
];

export default function DiscoverySourceUI() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="w-full max-w-lg relative top-12 mx-auto flex flex-col items-center">
      <h1 className="font-display text-neutral-600 font-semibold text-[18px]">
        How did you discover us?
      </h1>
      <h3 className="text-muted-foreground font-medium font-display text-center text-[14.5px]">
        We&apos;d love to know what caught your attention.
      </h3>

      {/* Grid: 4 on top row, 3 centered on bottom row */}
      <div className="mt-8 w-full flex flex-col items-center gap-4">
        {/* Top row – 4 items */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
          {SOURCES.slice(0, 4).map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              isActive={selected === source.id}
              onSelect={() => setSelected(source.id)}
            />
          ))}
        </div>
        {/* Bottom row – 3 items centered */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full sm:max-w-[75%]">
          {SOURCES.slice(4).map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              isActive={selected === source.id}
              onSelect={() => setSelected(source.id)}
            />
          ))}
        </div>
      </div>

      {/* Skip */}
      <button
        type="button"
        className="mt-8 text-[14.5px] font-display text-neutral-600 hover:text-neutral-700 transition"
      >
        Skip
      </button>
    </div>
  );
}

function SourceCard({
  source,
  isActive,
  onSelect,
}: {
  source: (typeof SOURCES)[number];
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = source.icon;

  return (
    <button
      onClick={onSelect}
      type="button"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-6 px-2",
        "rounded-none border transition-all duration-200",
        "bg-neutral-50 hover:border-neutral-400",
        isActive
          ? "border-black  ring-black/10 bg-white"
          : "border-neutral-200"
      )}
    >
      {Icon ? (
        <Icon className="h-10 w-10" />
      ) : (
        <span className="text-base font-display font-medium text-neutral-500 h-10 flex items-center">
          {source.label}
        </span>
      )}
      {Icon && (
        <span className="text-sm font-display font-medium text-neutral-600 whitespace-pre-line text-center leading-tight">
          {source.label}
        </span>
      )}
    </button>
  );
}
