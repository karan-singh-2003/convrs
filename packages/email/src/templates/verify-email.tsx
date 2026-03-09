import React from "react";
import { Heading, Section, Text } from "@react-email/components";
import EmailLayout from "../components/email-layout";

export default function VerifyEmail({
  email,
  code,
}: {
  email: string;
  code: string;
}) {
  return (
    <EmailLayout preview="Your Boilercode verification code" email={email}>
      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Please confirm your email address
      </Heading>

      <Text className="text-sm leading-6 text-black">
        Enter this code on the Boilercode verification page to complete your
        sign up:
      </Text>

      <Section className="my-8 border border-neutral-200">
        <div
          style={{
            textAlign: "center",
            padding: "14px 24px",
            fontFamily:
              "Google Sans, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif",
            fontSize: "28px",
            fontWeight: 600,
            letterSpacing: "0.25em",
          }}
        >
          {code}
        </div>
      </Section>

      <Text className="text-sm leading-6 text-black">
        This code expires in 10 minutes.
      </Text>
    </EmailLayout>
  );
}
