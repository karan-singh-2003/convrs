"use client";
import React, { useState } from "react";
import { Input, Button } from "@repo/ui";

const Form = ({
  title,
  description,
  inputAtts,
  buttonText,
  handleSubmit,
}: {
  title: string;
  description: string;
  buttonText: string;
  inputAtts: React.InputHTMLAttributes<HTMLInputElement>;
  handleSubmit: (data: any) => Promise<void>;
}) => {
  const { defaultValue, ...restInputAtts } = inputAtts;
  const [value, setValue] = useState(defaultValue || "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await handleSubmit({ [inputAtts.name || "input"]: value });
        setSaving(false);
      }}
    >
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="font-medium text-sm font-display text-neutral-600">
            {title}
          </h2>
          <p className="text-[14px] font-display text-neutral-500">
            {description}
          </p>
        </div>

        {/* Input + Button */}
        <div className="relative">
          <Input
            {...restInputAtts}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 pr-24 font-display rounded-none text-[14px] text-black/60"
          />

          {value && (
            <div className="absolute inset-y-0 right-1 flex items-center">
              <Button
                type="submit"
                variant="secondary"
                className="h-7 px-3 text-xs font-display text-[13px] rounded-full bg-[#F6F6F6] text-black/60"
                text={buttonText}
                loading={saving}
              />
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default Form;
