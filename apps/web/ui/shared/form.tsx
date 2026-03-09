"use client";
import React, { ReactNode, useState } from "react";
import { Input, Button, TooltipProvider } from "@repo/ui";

const Form = ({
  title,
  description,
  inputAtts,
  buttonText,
  handleSubmit,
  disabledTooltip,
}: {
  title: string;
  description: string;
  buttonText: string;
  inputAtts: React.InputHTMLAttributes<HTMLInputElement>;
  handleSubmit: (data: any) => Promise<void>;
  disabledTooltip?: string | ReactNode;
}) => {
  const { defaultValue, ...restInputAtts } = inputAtts;
  const [value, setValue] = useState(defaultValue || "");
  const [saving, setSaving] = useState(false);

  return (
    <TooltipProvider>
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
          <div className="relative w-full">
            <Input
              {...restInputAtts}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full font-display text-neutral-600"
            />

            {value && (
              <Button
                type="submit"
                variant="secondary"
                loading={saving}
                text={buttonText}
                disabledTooltip={disabledTooltip}
                className="absolute w-fit bg-transparent border-none font-display right-1 top-1/2 -translate-y-1/2 h-7 px-3 text-[13px] rounded-full  text-black/60"
              />
            )}
          </div>
        </div>
      </form>
    </TooltipProvider>
  );
};

export default Form;
