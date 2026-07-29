// lib/analytics/use-channel-breakdown.ts
import { useMemo } from "react";
import { classifyChannel, ChannelId, CHANNEL_LABELS, CHANNEL_COLORS, getReferrerDisplayName } from "@/lib/analytics/channels";

export type ReferrerRow = {
  referer: string;
  count: number;
  revenue: number;
  conversions: number;
};

export type PieSlice = {
  id: string;
  label: string;
  value: number;
  colorClassName: string;
  revenue: number;
  conversions: number;
  pct: number;
};

export type ChannelSlice = PieSlice & { id: ChannelId; members: ReferrerRow[] };

const MEMBER_COLORS = [
  "text-[#3B82F6]", "text-[#10B981]", "text-[#A855F7]", "text-[#EF4444]",
  "text-[#F59E0B]", "text-[#14B8A6]", "text-[#EC4899]", "text-[#6366F1]",
];

export function useChannelBreakdown(referrerData: ReferrerRow[] | null) {
  return useMemo(() => {
    if (!referrerData) return { channels: [] as ChannelSlice[], totalCount: 0 };

    const byChannel = new Map<ChannelId, ReferrerRow[]>();
    for (const row of referrerData) {
      const channel = classifyChannel(row.referer);
      const list = byChannel.get(channel) ?? [];
      list.push(row);
      byChannel.set(channel, list);
    }

    const totalCount = referrerData.reduce((sum, r) => sum + (r.count ?? 0), 0);

    const channels: ChannelSlice[] = Array.from(byChannel.entries())
      .map(([id, members]) => {
        const count = members.reduce((sum, m) => sum + (m.count ?? 0), 0);
        const revenue = members.reduce((sum, m) => sum + (m.revenue ?? 0), 0);
        const conversions = members.reduce((sum, m) => sum + (m.conversions ?? 0), 0);
        return {
          id,
          label: CHANNEL_LABELS[id],
          colorClassName: CHANNEL_COLORS[id],
          value: count,
          revenue,
          conversions,
          pct: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
          members: members.sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.value - a.value);

    return { channels, totalCount };
  }, [referrerData]);
}

/** Groups a channel's raw per-domain members by display name (e.g. t.co + x.com + twitter.com → "X") */
export function groupMembersByDisplayName(members: ReferrerRow[]): PieSlice[] {
  const byDisplay = new Map<string, { count: number; revenue: number; conversions: number }>();
  for (const m of members) {
    const label = getReferrerDisplayName(m.referer);
    const existing = byDisplay.get(label) ?? { count: 0, revenue: 0, conversions: 0 };
    existing.count += m.count ?? 0;
    existing.revenue += m.revenue ?? 0;
    existing.conversions += m.conversions ?? 0;
    byDisplay.set(label, existing);
  }
  const total = members.reduce((sum, m) => sum + (m.count ?? 0), 0);
  return Array.from(byDisplay.entries())
    .map(([label, v], i) => ({
      id: label,
      label,
      value: v.count,
      revenue: v.revenue,
      conversions: v.conversions,
      colorClassName: MEMBER_COLORS[i % MEMBER_COLORS.length],
      pct: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Groups raw per-domain rows for the full referrers list (not scoped to a channel) */
export function groupReferrersByDisplayName(rows: ReferrerRow[]) {
  return groupMembersByDisplayName(rows);
}