// channel-breakdown.tsx
"use client";

import { useContext, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn, currencyFormatter, nFormatter } from "@repo/utils";
import { PieChart } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";
import {
  useChannelBreakdown,
  groupMembersByDisplayName,
  ReferrerRow,
} from "@/lib/swr/use-channel-breakdown";
import { ChannelId } from "@/lib/analytics/channels";

export function ChannelBreakdown() {
  const { currency } = useContext(AnalyticsContext);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId | null>(null);

  const { data: referrerData } = useAnalyticsFilterOption("referers");

  const rows: ReferrerRow[] = useMemo(
    () =>
      (referrerData ?? []).map((d) => ({
        referer: d.referer,
        count: d.count ?? 0,
        revenue: d.revenue ?? 0,
        conversions: d.conversions ?? 0,
      })),
    [referrerData]
  );

  const { channels, totalCount } = useChannelBreakdown(rows);
  const activeChannel = channels.find((c) => c.id === selectedChannel);
  const pieData = activeChannel ? groupMembersByDisplayName(activeChannel.members) : channels;
  const formattedTotalCount = useMemo(
    () => new Intl.NumberFormat("en-US").format(totalCount),
    [totalCount]
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat("en-US"),
    []

  );
  const hasData = pieData.length > 0 && pieData.some((item) => item.value > 0);
  return (
    <div className="flex flex-col p-3 sm:p-2">
      {/* <div className="flex items-center gap-2 pb-2">
        {activeChannel ? (
          <button
            type="button"
            onClick={() => setSelectedChannel(null)}
            className="flex items-center gap-1.5 text-content-default hover:text-content-subtle transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="font-display text-sm font-medium">{activeChannel.label}</span>
          </button>
        ) : (
          null
        )}
      </div> */}
      <div className="h-[220px] sm:h-[340px] ">
        {hasData ? (
          <PieChart
            data={pieData}
            onSliceClick={(slice) => {
              if (!activeChannel) setSelectedChannel(slice.id as ChannelId);
            }}
            // centerContent={
            //   !activeChannel ? (
            //     <div className="text-center font-alexandria">
            //       <p className=" text-lg font-semibold text-content-default">
            //         {numberFormatter.format(totalCount)}
            //       </p>
            //       <p className="text-[13px] text-content-subtle">visitors</p>
            //     </div>
            //   ) : undefined
            // }
            renderTooltip={(slice) => (
              <div className="w-48 space-y-1.5 rounded-xl border border-border-subtle bg-bg-emphasis px-3 py-2 shadow-lg">
                <p className="truncate font-alexandria text-[12.5px] font-medium text-content-default">
                  {slice.label}
                </p>
                <div className="flex font-alexandria items-center justify-between text-[13px]">
                  <span className="text-content-subtle">Visitors</span>
                  <span className="font-medium text-content-default">
                    {numberFormatter.format(slice.value)}
                  </span>
                </div>
                <div className="flex font-alexandria items-center justify-between text-[13px]">
                  <span className="text-content-subtle">Revenue</span>
                  <span className="font-medium text-content-default">
                    {currencyFormatter(slice.revenue, { currency })}
                  </span>
                </div>
                <div className="flex font-alexandria items-center justify-between text-[13px]">
                  <span className="text-content-subtle">Conversion</span>
                  <span className="font-medium text-content-default">
                    {slice.value > 0
                      ? Math.round((slice.conversions / slice.value) * 1000) / 10
                      : 0}
                    %
                  </span>
                </div>
              </div>
            )}
          />
        ) : (
          <div className="flex h-[215px] items-center justify-center">
            <p className="text-[13px] font-poppins  text-[#737373]">
              No data available
            </p>
          </div>
        )}
      </div>

      {/* <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-2">
        {pieData.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => !activeChannel && setSelectedChannel(s.id as ChannelId)}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              activeChannel ? "cursor-default text-content-subtle" : "text-content-subtle hover:text-content-default"
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", s.colorClassName)} style={{ backgroundColor: "currentColor" }} />
            <span className="max-w-[100px] truncate">{s.label}</span>
            <span className="text-content-subtle/70">{s.pct}%</span>
          </button>
        ))}
      </div> */}
    </div>
  );
}