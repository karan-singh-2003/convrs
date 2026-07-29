import { cn } from "@repo/utils";
import { VariantProps, cva } from "class-variance-authority";
import { ReactNode, forwardRef } from "react";
import { Tooltip } from "./tooltip";

export const buttonVariants = cva("transition-all duration-200", {
  variants: {
    variant: {
      primary:
        "border border-bg-inverted bg-bg-inverted text-content-inverted hover:opacity-90",

      secondary: cn(
        "border border-border-subtle bg-bg-card text-content-emphasis hover:bg-bg-subtle",
        "data-[state=open]:border-border-emphasis data-[state=open]:ring-4 data-[state=open]:ring-border-subtle"
      ),

      outline:
        "border border-transparent bg-transparent text-content-default hover:bg-bg-subtle hover:text-content-emphasis",

      success:
        "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",

      danger:
        "border border-transparent bg-red-600 text-white hover:bg-red-700",

      "danger-outline":
        "border border-border-subtle bg-bg-card text-red-600 hover:bg-red-600 hover:text-white",

      auth:
        "w-full rounded-none border border-border-default bg-bg-subtle text-content-emphasis hover:bg-bg-muted font-medium",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

export interface ButtonProps
  extends
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  text?: ReactNode | string;
  textWrapperClassName?: string;
  shortcutClassName?: string;
  loading?: boolean;
  icon?: ReactNode;
  shortcut?: string;
  right?: ReactNode;
  disabledTooltip?: string | ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      text,
      variant = "primary",
      className,
      textWrapperClassName,
      shortcutClassName,
      loading,
      icon,
      shortcut,
      disabledTooltip,
      right,
      ...props
    }: ButtonProps,
    forwardedRef
  ) => {
    if (disabledTooltip) {
      return (
        <Tooltip content={disabledTooltip}>
          <div
            className={cn(
              "flex h-10 w-full cursor-not-allowed items-center justify-center gap-x-2 rounded-none bg-bg-subtle px-4 text-content-disabled transition-all md:text-sm focus:outline-none",
              {
                "border-transparent bg-transparent":
                  variant?.endsWith("outline"),
              },
              className
            )}
          >
            {icon}
            {text && (
              <div
                className={cn(
                  "min-w-0 truncate text-w",
                  shortcut && "flex-1 text-left",
                  textWrapperClassName
                )}
              >
                {text}
              </div>
            )}
            {shortcut && (
              <kbd
                className={cn(
                  "hidden rounded-full border font-display border-border-subtle bg-bg-subtle px-2 py-0.5 text-xs font-normal text-content-muted md:inline-block",
                  {
                    "bg-neutral-100": variant?.endsWith("outline"),
                  },
                  shortcutClassName
                )}
              >
                {shortcut}
              </kbd>
            )}
          </div>
        </Tooltip>
      );
    }
    return (
      <button
        ref={forwardedRef}
        // if onClick is passed, it's a "button" type, otherwise it's being used in a form, hence "submit"
        type={props.onClick ? "button" : "submit"}
        suppressHydrationWarning
        className={cn(
          "group flex h-10 w-full items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-border-subtle  justify-center gap-2 whitespace-nowrap rounded-none px-4 text-[15px]",
          props.disabled || loading
            ? "cursor-not-allowed border border-border-subtle bg-bg-subtle text-content-disabled"
            : buttonVariants({ variant }),
          className
        )}
        disabled={props.disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
           <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-bg-inverted" />
            <span className="text-sm font-display text-content-subtle">
              {text}
            </span>
          </div>
        ) : (
          <>
            {icon}
            {text && (
              <div
                className={cn(
                  "min-w-0 truncate font-medium",
                  shortcut && "flex-1 text-left",
                  textWrapperClassName
                )}
              >
                {text}
              </div>
            )}
            {shortcut && (
              <kbd
                className={cn(
                  "hidden rounded px-2 py-0.5 text-xs font-light transition-all duration-75 md:inline-block",
                  {
                    primary:
                      "bg-bg-card/20 text-content-inverted group-hover:bg-bg-card/30",

                    secondary:
                      "bg-bg-subtle text-content-subtle group-hover:bg-bg-muted",

                    outline:
                      "bg-bg-subtle text-content-default group-hover:bg-bg-muted",

                    danger:
                      "bg-red-500/30 text-white",

                    "danger-outline":
                      "bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white",
                  },
                  shortcutClassName
                )}
              >
                {shortcut}
              </kbd>
            )}
            {right}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
