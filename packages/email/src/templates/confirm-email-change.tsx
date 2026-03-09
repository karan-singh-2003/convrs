import React from "react";
import { Heading, Link, Preview, Section, Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";

export default function ConfirmEmailChange({
  email,
  newEmail,
  confirmUrl,
}: {
  email: string;
  newEmail: string;
  confirmUrl: string;
}) {
  return (
    <EmailLayout preview="Confirm your email address change" email={email}>
      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Confirm your email address change
      </Heading>

      <Text className="text-sm leading-6 text-black">
        Follow this link to confirm the update to your email from{" "}
        <strong>{email}</strong> to <strong>{newEmail}</strong>.
      </Text>

      <Section className="my-8">
        <Link
          href={confirmUrl}
          className="inline-block bg-black px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
        >
          Confirm email change
        </Link>
      </Section>

      <Text className="text-sm leading-6 text-black">
        If you did not request this change, this email can be safely ignored or{" "}
        <Link href={`${confirmUrl}?cancel=true`}>cancel this request</Link>.
      </Text>
    </EmailLayout>
  );
}
