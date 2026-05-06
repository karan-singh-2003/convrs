import React from "react";
import { Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";
import EmailButton from "../components/button";

export default function UsageLimitWarningEmail({
  email,
  workspaceName,
  ownerName,
  usage,
  usageLimit,
  upgradeUrl,
}: {
  email: string;
  workspaceName: string;
  ownerName: string | null;
  usage: number;
  usageLimit: number;
  upgradeUrl: string;
}) {
  const formatter = new Intl.NumberFormat("en-US");
  const usagePercent =
    usageLimit > 0 ? Math.min(100, Math.round((usage / usageLimit) * 100)) : 0;

  return (
    <EmailLayout
      preview={`You are at ${usagePercent}% of your event limit`}
      email={email}
    >
      <Heading className="text-2xl font-medium text-black mt-6">
        You are at {usagePercent}% of your event limit
      </Heading>

      <Text className="text-sm text-neutral-700">
        Hey{ownerName ? ` ${ownerName}` : ""}, your workspace {workspaceName}{" "}
        has used {formatter.format(usage)} of {formatter.format(usageLimit)}{" "}
        events this month.
      </Text>

      <Text className="text-sm text-neutral-700">
        Once you reach the limit, new events will stop being ingested. Upgrade
        to keep capturing data without gaps.
      </Text>

      <Section className="mt-8 mb-8">
        <EmailButton href={upgradeUrl}>Upgrade your plan</EmailButton>
      </Section>

      <Text className="text-sm text-neutral-600">
        If you already upgraded, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
