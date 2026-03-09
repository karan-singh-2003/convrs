import React from "react";
import { Heading, Link, Text } from "@react-email/components";
import  EmailLayout  from "../components/email-layout";

export default function EmailUpdated({
  oldEmail,
  newEmail,
  isPartnerProfile = false,
}: {
  oldEmail: string;
  newEmail: string;
  isPartnerProfile?: boolean;
}) {
  return (
    <EmailLayout preview="Your email address has been updated" email={oldEmail}>
      
      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Your email address has been changed
      </Heading>

      <Text className="text-sm leading-6 text-black">
        The email address for your Boilercode{" "}
        {isPartnerProfile ? "partner profile" : "account"} has been updated
        from <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>.
      </Text>

      <Text className="text-sm leading-6 text-black">
        If you did not make this change, please contact support or{" "}
        <Link href="https://app.boilercode.dev/account/settings">
          update your email address
        </Link>.
      </Text>

      <Text className="text-sm leading-6 text-black">
        This message was sent to your previous email address.
      </Text>

    </EmailLayout>
  );
}