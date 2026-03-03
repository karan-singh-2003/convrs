import { cn } from "@repo/utils";
import { cva, VariantProps } from "class-variance-authority";
import { ReactNode } from "react";

const pageWidthVariants = cva(
  "@container/page mx-auto w-full px-3 lg:px-6",
  {
    variants: {
      size: {
        sm: "max-w-screen-sm",
        md: "max-w-screen-md",
        lg: "max-w-screen-lg",
        xl: "max-w-screen-xl",
        "2xl": "max-w-screen-2xl",
        full: "max-w-full",
        prose: "max-w-3xl",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

interface PageWidthWrapperProps
  extends VariantProps<typeof pageWidthVariants> {
  className?: string;
  children: ReactNode;
}

export function PageWidthWrapper({
  size,
  className,
  children,
}: PageWidthWrapperProps) {
  return (
    <div className={cn(pageWidthVariants({ size }), className)}>
      {children}
    </div>
  );
}