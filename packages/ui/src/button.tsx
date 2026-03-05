import { cn } from "@repo/utils";
import { VariantProps, cva } from "class-variance-authority";
import { ReactNode, forwardRef } from "react";
import { Tooltip } from "./tooltip";

export const buttonVariants = cva("transition-all", {
  variants: {
    variant: {
      primary:
        "border-black bg-black dark:bg-white dark:border-white text-content-inverted hover:bg-inverted hover:ring-0 e",
      secondary: cn(
        "border-border-subtle bg-white dark:bg-black text-content-emphasis hover:bg-bg-muted  outline-none",
        "data-[state=open]:border-border-emphasis data-[state=open]:ring-4 data-[state=open]:ring-border-subtle"
      ),
      outline: "border-transparent text-content-default hover:bg-bg-subtle",
      success:
        "border-blue-500 bg-blue-500 text-white hover:bg-blue-600 hover:ring-4 hover:ring-blue-100",
      danger: " bg-[#BC2D2D] text-white hover:bg-[#DD3C3C] ",
      "danger-outline":
        "border-transparent bg-white text-red-500 hover:bg-red-600 hover:text-white",
      auth: "rounded-none font-medium border border-[#2a2a2a] bg-[#1a1a1a] text-white w-full hover:bg-[#222222] hover:border-[#333333]",
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
              "flex h-10 w-full cursor-not-allowed items-center justify-center gap-x-2 rounded-none border border-neutral-200 bg-neutral-100 px-4 text-sm text-neutral-400 transition-all focus:outline-none",
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
                  "hidden rounded border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-light text-neutral-400 md:inline-block",
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
        className={cn(
          "group flex h-10 w-full items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-border-subtle  justify-center gap-2 whitespace-nowrap rounded-none px-4 text-[15px]",
          props.disabled || loading
            ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 outline-none"
            : buttonVariants({ variant }),
          className
        )}
        disabled={props.disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            <span className="text-sm font-display text-neutral-500">{text}</span>
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
                    "bg-neutral-700 text-neutral-400 group-hover:bg-neutral-600 group-hover:text-neutral-300":
                      variant === "primary",
                    "bg-neutral-200 text-neutral-400 group-hover:bg-neutral-100 group-hover:text-neutral-500":
                      variant === "secondary",
                    "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200":
                      variant === "outline",
                    "bg-red-400 text-white": variant === "danger",
                    "bg-red-100 text-red-600 group-hover:bg-red-500 group-hover:text-white":
                      variant === "danger-outline",
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
