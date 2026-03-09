import React from "react";
import { Heading, Link, Text } from "@react-email/components";
import  EmailLayout  from "../components/email-layout";

export default function TwoFactorDisabled({
  email,
}: {
  email: string;
}) {
  return (
    <EmailLayout preview="Two-factor authentication disabled" email={email}>

      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Two-factor authentication disabled
      </Heading>

      <Text className="text-sm leading-6 text-black">
        Two-factor authentication (2FA) has been successfully disabled for your
        Boilercode account.
      </Text>

      <Text className="text-sm leading-6 text-black">
        If you did not make this change, please contact{" "}
        <Link href="mailto:support@boilercode.dev">support</Link> immediately.
      </Text>

    </EmailLayout>
  );
}