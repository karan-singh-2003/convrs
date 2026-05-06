import { Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";

import React from "react";

export const PreviewProps = {
  content: "Hi there,\n\nNew alert content preview.",
};

export default function AlertEmailTemplate({
  content = "",
}: {
  content?: string;
}) {
  const lines = content.split(/\r?\n/);

  return (
    <EmailLayout preview="New alert" email="">
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} className="text-sm leading-6 text-black">
          {line.length === 0 ? " " : line}
        </Text>
      ))}
    </EmailLayout>
  );
}
