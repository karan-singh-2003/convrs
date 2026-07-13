import { Heading, Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";

import React from "react";

export default function TrafficSpikeEmail({
  workspaceName,
  recipientName,
  currentClicks,
  baselineMean,
}: {
  workspaceName: string;
  recipientName?: string | null;
  currentClicks: number;
  baselineMean: number;
}) {
  const increase =
    baselineMean > 0
      ? (((currentClicks - baselineMean) / baselineMean) * 100).toFixed(1)
      : null;

  return (
    <EmailLayout
      preview={`Traffic spike detected on ${workspaceName}`}
      email=""
    >
      <Heading className="text-xl font-semibold text-black">
        🚀 Traffic spike detected
      </Heading>

      <Text className="text-sm leading-6 text-neutral-700">
        Hi {recipientName ?? "there"},
      </Text>

      <Text className="text-sm leading-6 text-neutral-700">
        Your website <strong>{workspaceName}</strong> is receiving
        significantly more traffic than usual.
      </Text>

      <Text className="text-sm leading-6 text-black">
        • Current hour: <strong>{currentClicks.toLocaleString()}</strong>{" "}
        visitors
      </Text>

      <Text className="text-sm leading-6 text-black">
        • Typical hour: <strong>{baselineMean.toLocaleString()}</strong>{" "}
        visitors
      </Text>

      {increase && (
        <Text className="text-sm leading-6 text-black">
          • Increase: <strong>+{increase}%</strong>
        </Text>
      )}

      <Text className="mt-6 text-sm leading-6 text-neutral-700">
        This could be caused by a successful campaign, a social media post,
        search traffic, or another unexpected source. It's a good time to check
        your live analytics dashboard.
      </Text>

      <Text className="mt-8 text-sm leading-6 text-neutral-600">
        Thanks for using Convrs.
      </Text>
    </EmailLayout>
  );
}