// apps/web/ui/workspaces/revenue/provider-selector.tsx
"use client";
import { Popover } from "@repo/ui";
import { Check, ChevronDown } from "lucide-react";
import { PROVIDERS, Provider } from "./provider-config";

export function ProviderSelector({
  provider,
  setProvider,
  openPopover,
  setOpenPopover,
}: {
  provider: Provider;
  setProvider: (p: Provider) => void;
  openPopover: boolean;
  setOpenPopover: (open: boolean) => void;
}) {
  const selected = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <div className="flex items-center justify-between rounded-2xl bg-neutral-50 p-0">
      <Popover
        openPopover={openPopover}
        setOpenPopover={setOpenPopover}
        align="center"
        popoverContentClassName="rounded-2xl"
        content={
          <div className="w-[var(--radix-popover-trigger-width)] p-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setProvider(p.value);
                  setOpenPopover(false);
                }}
                className="flex w-full items-center justify-between rounded-none px-2.5 py-2 text-left text-sm hover:bg-neutral-100"
              >
                <span className="flex font-display text-neutral-600 items-center gap-2">
                  <div className="flex items-center justify-center">{p.img}</div>
                  {p.label}
                </span>
                {provider === p.value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        }
      >
        <button className="flex h-10 w-full font-display items-center gap-1.5 rounded-lg border justify-between border-neutral-200 bg-neutral-100 px-4 text-[15px] font-medium text-neutral-700">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center">{selected.img}</div>
            <p className="text-neutral-600">  {selected.label}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </Popover>
    </div>
  );
}