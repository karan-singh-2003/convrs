"use client";

import { cn } from "@repo/utils";
import { AlertCircle } from "lucide-react";
import React, { useState } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className={cn("flex flex-col gap-y-1.5 w-full", className)}>
        <div className="relative w-full">
          <input
            ref={ref}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "h-10 w-full rounded-sm font-display border border-neutral-300 bg-white px-3 text-sm md:text-[15px] text-neutral-700 placeholder-neutral-400 transition-colors",
              "read-only:bg-neutral-50 read-only:text-neutral-500",
              "focus:border-neutral-500 focus:outline-none focus:ring-0",
              error && "border-red-400 focus:border-red-500",
              (error || isPassword) && "pr-9"
            )}
            aria-invalid={!!error}
            {...props}
          />

          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isPassword ? (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {showPassword ? (
                  <span className="text-sm font-display">Hide</span>
                ) : (
                  <span className="text-sm font-display">Show</span>
                )}
              </button>
            ) : error ? (
              <AlertCircle className="size-4 text-red-500 pointer-events-none" aria-hidden />
            ) : null}
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium text-red-500" role="alert" aria-live="assertive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
