import { cn } from "@repo/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-none bg-neutral-100", className)} {...props} />
  );
}