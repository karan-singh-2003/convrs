export type Metric = { label: string; value: string };

export function CustomerMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 md:sticky md:top-0 z-10 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-bg-emphasis/70 p-2 rounded-[18px]">
      {metrics.map((item) => (
        <div
          key={item.label}
          className="bg-bg-card rounded-[16px] space-y-1 px-4 sm:px-6 py-5 min-h-24"
        >
          <p className="text-[14px] font-display text-content-subtle">
            {item.label}
          </p>
          <p className="text-lg sm:text-xl font-bricolageGrotesque font-medium text-content-default break-words">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}