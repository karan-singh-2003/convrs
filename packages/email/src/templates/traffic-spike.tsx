import { Heading, Text } from "@react-email/components";
import { Button } from "@react-email/button";
import EmailLayout, {
  POPPINS_FONT_FAMILY,
  ALEXANDRIA_FONT_FAMILY,
} from "../components/email-layout";
import { APP_DOMAIN } from "@repo/utils";

import React from "react";

export const PreviewProps = {
  workspaceName: "deformity.ai",
  workspaceSlug: "deformity-ai",
  recipientName: "Jordan",
  recipientEmail: "jordan@deformity.ai",
  currentClicks: 842,
  baselineMean: 96,
  threshold: 100,
};

export default function TrafficSpikeEmail({
  workspaceName,
  workspaceSlug,
  recipientName,
  recipientEmail,
  currentClicks,
  baselineMean,
  threshold,
}: {
  workspaceName: string;
  workspaceSlug: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  currentClicks: number;
  baselineMean: number;
  threshold: number;
}) {
  const increase =
    baselineMean > 0
      ? (((currentClicks - baselineMean) / baselineMean) * 100).toFixed(1)
      : null;
  const dashboardUrl = `${APP_DOMAIN}/${workspaceSlug}`;

  return (
    <EmailLayout
      preview={`Traffic spike detected on ${workspaceName}`}
      email={recipientEmail ?? ""}
    >
      <Heading
        className="text-xl font-semibold text-black"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
         Traffic spike detected
      </Heading>

      <Text
        className="text-sm leading-6 text-neutral-700"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Hi {recipientName ?? "there"},
      </Text>

      <Text
        className="text-sm leading-6 text-neutral-700"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Your website <strong>{workspaceName}</strong> is receiving
        significantly more traffic than usual.
      </Text>

      <Text
        className="text-sm leading-6 text-black"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        • Current hour:{" "}
        <strong style={{ fontFamily: ALEXANDRIA_FONT_FAMILY }}>
          {currentClicks.toLocaleString()}
        </strong>{" "}
        visitors
      </Text>

      <Text
        className="text-sm leading-6 text-black"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        • Typical hour:{" "}
        <strong style={{ fontFamily: ALEXANDRIA_FONT_FAMILY }}>
          {baselineMean.toLocaleString()}
        </strong>{" "}
        visitors
      </Text>

      {increase && (
        <Text
          className="text-sm leading-6 text-black"
          style={{ fontFamily: POPPINS_FONT_FAMILY }}
        >
          • Increase:{" "}
          <strong style={{ fontFamily: ALEXANDRIA_FONT_FAMILY }}>
            +{increase}%
          </strong>
        </Text>
      )}

      <Text
        className="text-sm leading-6 text-black"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        • Alert threshold:{" "}
        <strong style={{ fontFamily: ALEXANDRIA_FONT_FAMILY }}>
          {threshold.toLocaleString()}
        </strong>{" "}
        visitors/hour
      </Text>

      <Text
        className="mt-6 text-sm leading-6 text-neutral-700"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        This could be caused by a successful campaign, a social media post,
        search traffic, or another unexpected source. It's a good time to
        check your live analytics dashboard.
      </Text>

      <Button
        href={dashboardUrl}
        className="mt-4 box-border w-full rounded-full bg-black px-6 py-3 text-center text-sm font-semibold text-white"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        View Dashboard
      </Button>

      <Text
        className="mt-8 text-sm leading-6 text-neutral-600"
        style={{ fontFamily: POPPINS_FONT_FAMILY }}
      >
        Thanks for using Convrs.
      </Text>
    </EmailLayout>
  );
}
