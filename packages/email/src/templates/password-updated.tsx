import React from "react";
import { Heading, Text } from "@react-email/components";
import  EmailLayout  from "../components/email-layout";

export default function PasswordUpdated({
  email,
  verb = "updated",
}: {
  email: string;
  verb?: "reset" | "updated";
}) {
  return (
    <EmailLayout preview={`Your password has been ${verb}`} email={email}>
      
      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Password has been {verb}
      </Heading>

      <Text className="text-sm leading-6 text-black">
        The password for your Boilercode account has been successfully {verb}.
      </Text>

      <Text className="text-sm leading-6 text-black">
        If you did not make this change or believe someone has accessed your
        account without permission, please contact support immediately to secure
        your account.
      </Text>

    </EmailLayout>
  );
}