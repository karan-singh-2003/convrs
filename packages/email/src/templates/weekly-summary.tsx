import { Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";

import React from "react";

export interface WeeklySummaryStats {
  clicks: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
  clicksChangePct: number | null;
  revenueChangePct: number | null;
  topLinks: { url: string; clicks: number }[];
  topCountries: { country: string; clicks: number }[];
}


export default function WeeklySummaryEmail({
  workspaceName,
  recipientName,
  stats,
}: {
  workspaceName: string;
  recipientName?: string | null;
  stats: WeeklySummaryStats;
}) {
  const fmtChange = (pct: number | null) =>
    pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

  return (
    <EmailLayout
      preview={`Your weekly analytics report for ${workspaceName}`}
      email=""
    >
      <Heading className="text-xl font-semibold text-black">
        Weekly report
      </Heading>

      <Text className="text-sm leading-6 text-neutral-700">
        Hi {recipientName ?? "there"},
      </Text>

      <Text className="text-sm leading-6 text-neutral-700">
        Here's your analytics summary for <strong>{workspaceName}</strong> over
        the last 7 days.
      </Text>

      <Section className="mt-6">
        <Heading className="text-base font-semibold text-black">
          Overview
        </Heading>

        <Text className="text-sm leading-6 text-black">
          • Visitors: <strong>{stats.clicks.toLocaleString()}</strong>{" "}
          ({fmtChange(stats.clicksChangePct)})
        </Text>

        <Text className="text-sm leading-6 text-black">
          • Revenue:{" "}
          <strong>${(stats.revenue / 100).toFixed(2)}</strong>{" "}
          ({fmtChange(stats.revenueChangePct)})
        </Text>
      </Section>

      <Section className="mt-6">
        <Heading className="text-base font-semibold text-black">
          Top pages
        </Heading>

        {stats.topLinks.length === 0 ? (
          <Text className="text-sm text-neutral-500">
            No page data available.
          </Text>
        ) : (
          stats.topLinks.map((page) => (
            <Text
              key={page.url}
              className="text-sm leading-6 text-black"
            >
              • {page.url} — {page.clicks.toLocaleString()} visitors
            </Text>
          ))
        )}
      </Section>

      <Section className="mt-6">
        <Heading className="text-base font-semibold text-black">
          Top countries
        </Heading>

        {stats.topCountries.length === 0 ? (
          <Text className="text-sm text-neutral-500">
            No country data available.
          </Text>
        ) : (
          stats.topCountries.map((country) => (
            <Text
              key={country.country}
              className="text-sm leading-6 text-black"
            >
              • {country.country} — {country.clicks.toLocaleString()} visitors
            </Text>
          ))
        )}
      </Section>

      <Text className="mt-8 text-sm leading-6 text-neutral-600">
        Thanks for using Convrs.
      </Text>
    </EmailLayout>
  );
}