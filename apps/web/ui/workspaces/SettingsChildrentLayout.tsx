import { cn } from "@repo/utils";
import React from "react";

export default function SettingsChildrenLayout({
  title,
  description,
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-y-4 ", className)}>
      {/* Header */}
      <div className="px-1 flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="font-display text-[16px] font-medium text-[#555555]">
            {title}
          </h1>
          <p className="font-display text-[14px] font-medium text-[#727272] opacity-90">
            {description}
          </p>
        </div>

        {/* Actions (Buttons) */}
        {actions && <>{actions}</>}
      </div>

      {/* Content */}
      <div className={`bg-[#fafafa] rounded-2xl  ${actions ? "p-0" : "p-0"}`}>
        {children}
      </div>
    </div>
  );
}
