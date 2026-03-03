import { ReactNode } from "react";
import { cn } from "@repo/utils";
export function PageWithWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "@container/page mx-auto w-full my-2 max-w-screen-xl px-3 lg:px-6",
        className
      )}
    >
      {children}
    </div>
  );
}
