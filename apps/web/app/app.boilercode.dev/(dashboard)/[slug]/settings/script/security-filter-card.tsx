"use client";

import { Button } from "@repo/ui";
import { Info } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type SecurityFilterCardProps = {
  title: string;
  description: string;
  placeholder: string;
  actionLabel: string;
  helperText: string;
  emptyText: string;
  defaultItems?: string[];
  allowInfoIcon?: boolean;
};

function normalizeValue(value: string) {
  return value.trim();
}

export function SecurityFilterCard({
  title,
  description,
  placeholder,
  actionLabel,
  helperText,
  emptyText,
  defaultItems = [],
  allowInfoIcon = false,
}: SecurityFilterCardProps) {
  const [inputValue, setInputValue] = useState("");
  const [items, setItems] = useState<string[]>(defaultItems);

  const canSubmit = useMemo(
    () => normalizeValue(inputValue).length > 0,
    [inputValue]
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = normalizeValue(inputValue);
    if (!normalized) {
      return;
    }

    setItems((previous) => {
      const alreadyExists = previous.some(
        (item) => item.toLowerCase() === normalized.toLowerCase()
      );

      if (alreadyExists) {
        return previous;
      }

      return [...previous, normalized];
    });

    setInputValue("");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="space-y-3 p-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium font-display text-neutral-700">
            {title}
          </h3>
          <p className="text-[14px] font-display text-neutral-500">
            {description}
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <div className="relative flex items-center">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-none border border-neutral-200 bg-neutral-100/80 pl-3 pr-24 text-[14px] font-display text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none"
            />

            <Button
              text={actionLabel}
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              className="absolute right-1 top-1/2 h-8 w-fit -translate-y-1/2 rounded-md bg-transparent px-3 text-[13px] font-display text-black/60"
            />
          </div>
        </form>

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-x-2">
            {items.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-sm  bg-neutral-50 px-2.5 py-0.5 text-[13px] font-display text-neutral-600"
              >
                {item}
                {allowInfoIcon && (
                  <Info className="h-3.5 w-3.5 text-neutral-400" />
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] font-display text-neutral-500">
            {emptyText}
          </p>
        )}
      </div>

      {/* <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-[13px] font-display text-neutral-500">
          {helperText}
        </p>
      </div> */}
    </div>
  );
}
