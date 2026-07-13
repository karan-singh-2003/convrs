"use client";

import { Combobox } from "@repo/ui";
import { ChevronDown } from "lucide-react";

export const CURRENCIES = [
  { value: "AED", label: "AED - United Arab Emirates Dirham (AED)" },
  { value: "AUD", label: "AUD - Australian Dollar (AU$)" },
  { value: "BRL", label: "BRL - Brazilian Real (R$)" },
  { value: "CAD", label: "CAD - Canadian Dollar (CA$)" },
  { value: "CHF", label: "CHF - Swiss Franc (CHF)" },
  { value: "CNY", label: "CNY - Chinese Yuan (CN¥)" },
  { value: "CZK", label: "CZK - Czech Republic Koruna (Kč)" },
  { value: "EUR", label: "EUR - Euro (€)" },
  { value: "GBP", label: "GBP - British Pound Sterling (£)" },
  { value: "HKD", label: "HKD - Hong Kong Dollar (HK$)" },
  { value: "IDR", label: "IDR - Indonesian Rupiah (Rp)" },
  { value: "INR", label: "INR - Indian Rupee (₹)" },
  { value: "JPY", label: "JPY - Japanese Yen (¥)" },
  { value: "KRW", label: "KRW - South Korean Won (₩)" },
  { value: "NZD", label: "NZD - New Zealand Dollar (NZ$)" },
  { value: "NOK", label: "NOK - Norwegian Krone (Nkr)" },
  { value: "PLN", label: "PLN - Polish Zloty (zł)" },
  { value: "SGD", label: "SGD - Singapore Dollar (S$)" },
  { value: "USD", label: "USD - US Dollar ($)" },
];

export const DEFAULT_CURRENCY = CURRENCIES.find((c) => c.value === "USD")!;

interface CurrencyPickerProps {
  /** Currently selected currency code, e.g. "USD" */
  value: string;
  onChange: (currencyCode: string) => void;
  disabled?: boolean;
}

/**
 * Pure controlled combobox — no fetch, no side effects.
 * The parent is responsible for persisting the selection.
 */
export default function Currency({ value, onChange, disabled }: CurrencyPickerProps) {
  const selected =
    CURRENCIES.find((c) => c.value === value) ?? DEFAULT_CURRENCY;

  return (
    <Combobox
      selected={selected}
      setSelected={(option) => {
        if (option) onChange(option.value);
      }}
      options={CURRENCIES}
      searchPlaceholder="Search currency..."
      placeholder="Select currency"
      trigger={
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2 font-display text-[14.5px] text-neutral-500 transition hover:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="truncate">{selected.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
        </button>
      }
    />
  );
}