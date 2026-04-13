import { cn } from "@repo/utils";
import { VariantProps, cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { ComponentProps, forwardRef } from "react";

const triggerStyles = cva(
  [
    "group peer px-4 flex appearance-none font-medium text-neutral-500 items-center gap-x-2 truncate rounded-full border border-neutral-200  h-9 outline-none transition-all text-sm font-display",
    "bg-white border-neutral-200 text-neutral-900 placeholder-neutral-400 transition-all",
    "cursor-pointer disabled:cursor-not-allowed",
    "disabled:bg-neutral-100 disabled:text-neutral-400",
    "",
    //" aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-200 aria-[invalid=true]:border-red-500 invalid:ring-2 invalid:ring-red-200 invalid:border-red-500",
  ],
  {
    variants: {
      hasError: {
        true: "ring-2 ring-red-200 border-red-500",
      },
    },
  }
);

interface TriggerProps
  extends ComponentProps<"button">, VariantProps<typeof triggerStyles> {
  placeholder?: string;
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>(
  (
    {
      className,
      children,
      placeholder,
      hasError,
      disabled,
      ...props
    }: TriggerProps,
    forwardedRef
  ) => {
    return (
      <button
        ref={forwardedRef}
        className={cn(triggerStyles({ hasError }), className)}
        disabled={disabled}
        {...props}
      >
        {/* <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          role="img"
          focusable="false"
          aria-hidden="true"
          className="h-4.5 w-4.5 shrink-0 text-neutral-700"
        >
          <path
            d="M11 1C13.2091 1 15 2.79086 15 5V11C15 13.2091 13.2091 15 11 15H5C2.79086 15 1 13.2091 1 11V5C1 2.79086 2.79086 1 5 1H11ZM13.5 6H2.5V11C2.5 12.3807 3.61929 13.5 5 13.5H11C12.3807 13.5 13.5 12.3807 13.5 11V6Z"
            fill="currentColor"
          />
        </svg> */}
        <span className="flex-1 overflow-hidden text-[14px] font-default text-neutral-500 text-ellipsis whitespace-nowrap text-left">
          {children ? (
            <span >{children}</span>
          ) : placeholder ? (
            <span >{placeholder}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0  text-neutral-400 transition-transform duration-75 group-data-[state=open]:rotate-180`}
        />
      </button>
    );
  }
);

Trigger.displayName = "DatePicker.Trigger";

export { Trigger };
