import { Heading, Section, Text, Row, Column } from "@react-email/components";
import { Button } from "@react-email/button";
import EmailLayout, {
  POPPINS_FONT_FAMILY,
  ALEXANDRIA_FONT_FAMILY,
} from "../components/email-layout";
import { formatCurrency, APP_DOMAIN } from "@repo/utils";
import React from "react";

export interface WeeklySummaryEmailStats {
  clicks: number;
  clicksChangePct: number | null;
  revenue: number;
  bounceRate: number;
  liveVisitors: number;
  currency: string;
  weekStart: string; // ISO
  weekEnd: string; // ISO
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d
    .toLocaleString("en-US", { month: "short" })
    .toLowerCase()}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Column align="left" style={{ paddingRight: 24 }}>
      <Text
        className="m-0 text-xs text-neutral-500"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        {label}
      </Text>
      <Text
        className="m-0 mt-1 text-xl font-semibold text-black"
        style={{ fontFamily: ALEXANDRIA_FONT_FAMILY }}
      >
        {value}
      </Text>
    </Column>
  );
}

export const PreviewProps = {
  workspaceName: "deformity.ai",
  workspaceSlug: "deformity-ai",
  recipientName: "Jordan",
  recipientEmail: "jordan@deformity.ai",
  stats: {
    clicks: 37,
    clicksChangePct: 12.4,
    revenue: 0,
    bounceRate: 0,
    liveVisitors: 2,
    currency: "USD",
    weekStart: "2026-08-24T00:00:00.000Z",
    weekEnd: "2026-08-31T00:00:00.000Z",
  },
};

export default function WeeklySummaryEmail({
  workspaceName,
  workspaceSlug,
  recipientName,
  recipientEmail,
  stats,
}: {
  workspaceName: string;
  workspaceSlug: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  stats: WeeklySummaryEmailStats;
}) {
  const monthName = new Date(stats.weekEnd).toLocaleString("en-US", {
    month: "long",
  });
  const dateRange = `${formatShortDate(stats.weekStart)} - ${formatShortDate(
    stats.weekEnd
  )}`;
  const dashboardUrl = `${APP_DOMAIN}/${workspaceSlug}`;

  return (
    <EmailLayout
      preview={`Your weekly analytics report for ${workspaceName} is ready`}
      email={recipientEmail ?? ""}
    >
      <Text
        className="text-sm leading-6 text-neutral-700"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Hi {recipientName ?? "there"},
      </Text>

      <Section className="mt-2 rounded-xl border border-neutral-200 p-6">
        <Heading
          className="m-0 text-lg font-semibold text-black"
          style={{ fontFamily: POPPINS_FONT_FAMILY }}
        >
          {workspaceName}
        </Heading>
        <Text
          className="m-0 mt-1 text-sm text-neutral-500"
          style={{ fontFamily: POPPINS_FONT_FAMILY }}
        >
          {monthName} Report ({dateRange})
        </Text>

        <Row className="mt-6">
          <Metric label="Unique visitors" value={stats.clicks.toLocaleString()} />
          <Metric
            label="Revenue"
            value={formatCurrency(stats.revenue, stats.currency)}
          />
          <Metric
            label="Bounce rate"
            value={`${Math.round(stats.bounceRate)}%`}
          />
          <Metric
            label="Live visitors"
            value={stats.liveVisitors.toLocaleString()}
          />
        </Row>

        <Button
          href={dashboardUrl}
          className="mt-6 box-border w-full rounded-full bg-black px-6 py-3 text-center text-sm font-semibold text-white"
          style={{ fontFamily: POPPINS_FONT_FAMILY }}
        >
          View Dashboard
        </Button>
      </Section>

      <Text
        className="mt-6 text-sm leading-6 text-neutral-600"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Your full analytics report — devices, browsers, locations, top pages,
        referrers, and more — is attached as a PDF.
      </Text>

      <Text
        className="mt-8 text-sm leading-6 text-neutral-600"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Thanks for using Convrs.
      </Text>
    </EmailLayout>
  );
}
