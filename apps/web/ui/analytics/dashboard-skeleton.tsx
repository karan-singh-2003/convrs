import { Skeleton } from "@repo/ui";
import { cn } from "@repo/utils";

function BarListRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
      <Skeleton className="h-3 w-8 shrink-0 rounded-full" />
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <div className="h-[400px] overflow-hidden rounded-lg border border-border-subtle bg-bg-card sm:h-[450px] sm:rounded-xl">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-3 sm:px-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>

      <div className="space-y-2 px-2 py-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <BarListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="my-2 space-y-4">
      {/* Toggle bar */}
      {/* <div className="max-w-screen-lg mx-auto w-full overflow-hidden rounded-xl bg-bg-card py-3">
        <div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-40 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      </div> */}

      <div className="space-y-[4rem]">
        {/* Chart */}
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card sm:rounded-xl">
          <div className="flex items-center justify-center gap-8 border-b border-border-subtle px-4 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>

          <div className="flex h-[444px] w-full items-end gap-2 p-6 sm:h-[464px]">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-full rounded-t-md"
                style={{ height: `${20 + ((i * 37) % 70)}%` }}
              />
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid max-w-screen-lg mx-auto grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Bot filtering card */}
      <div className="max-w-screen-lg mx-auto flex h-[450px] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-card">
        <div className="flex border-b border-border-subtle">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "px-6 py-3",
                i === 0 && "border-b-1 border-border-subtle"
              )}
            >
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-2/3 p-4">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>

          <div className="w-1/3 space-y-4 border-l border-border-subtle p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <BarListRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
