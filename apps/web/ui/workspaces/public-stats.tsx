"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Switch } from "@repo/ui";
import { useState } from "react";

export default function PublicStats() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <div className="relative w-full flex justify-between items-center bg-white p-4 border-neutral-200 rounded-2xl border space-y-2 ">
        <div className="space-y-0.5 font-display">
          <h2 className="font-medium text-neutral-600 text-sm">
            Public Dashboard
          </h2>
          <p className="font-default text-[13.5px] text-neutral-500">
            Share your project stats with the public.
          </p>
        </div>
        <Switch
          disabled={loading}
          checked={enabled || false}
          trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
          thumbDimensions="size-3"
          thumbTranslate="translate-x-3"
          fn={setEnabled}
        />
      </div>
    </>
  );
}
