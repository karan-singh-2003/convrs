"use client";

import { Suspense, useState, type ComponentType } from "react";
import { cn } from "@repo/utils";
import { Google, Github, XLogo, Youtube, Reddit, ProductHunt } from "@repo/ui";
import { Button } from "@repo/ui";
import { useOnboardingProgress } from "../../use-onboarding-progress";
import { toast } from "sonner";

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

export default function DiscoverySourcePage() {
  return (
    <Suspense>
      <DiscoverySourceUI />
    </Suspense>
  );
}

function DiscoverySourceUI() {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { finish, isLoading, isSuccessful } = useOnboardingProgress();

  const handleNext = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await fetch("/api/account/source", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: selected }),
      });
    } catch {
      toast.error("Failed to save your selection, but continuing.");
    }
    finish();
  };

  return (
    <div className="w-full max-w-lg relative top-16 sm:top-16 mx-auto flex flex-col items-center px-4">
      <h1 className="font-display text-neutral-500 font-semibold text-base sm:text-[18px] text-center">
        How did you discover us?
      </h1>
      <h3 className="text-neutral-600 font-medium font-display text-center text-sm sm:text-[14.5px]">
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

      {/* Actions */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          onClick={handleNext}
          disabled={!selected || submitting || isLoading || isSuccessful}
          loading={submitting || isSuccessful}
          text="Finish"
          className="text-white font-display px-10"
        />
        <button
          type="button"
          onClick={() => finish()}
          disabled={submitting || isLoading || isSuccessful}
          className="text-sm font-display text-neutral-400 hover:text-neutral-600 transition disabled:opacity-50"
        >
          Skip
        </button>
      </div>
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
        "flex flex-col items-center justify-center",
        "gap-1.5 sm:gap-3",
        "py-3 sm:py-6 px-2",
        "min-h-[90px] sm:min-h-[120px]",
        "rounded-md sm:rounded-none",
        "border transition-all duration-200",
        "bg-neutral-50 hover:border-neutral-400",
        isActive
          ? "border-black ring-1 ring-black/10 bg-white"
          : "border-neutral-200"
      )}
    >
      {Icon ? (
        <Icon className="h-7 w-7 sm:h-10 sm:w-10" />
      ) : (
        <span className="text-sm sm:text-base font-display font-medium text-neutral-500 flex items-center">
          {source.label}
        </span>
      )}

      {Icon && (
        <span className="text-xs sm:text-sm font-display font-medium text-neutral-600 whitespace-pre-line text-center leading-tight">
          {source.label}
        </span>
      )}
    </button>
  );
}
