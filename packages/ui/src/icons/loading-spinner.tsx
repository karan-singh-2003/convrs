import { cn } from "@repo/utils";

export function LoadingSpinner({
  className,
}: {
  className?: string;
  text?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
    </div>
  );
}
