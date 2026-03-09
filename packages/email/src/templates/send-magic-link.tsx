import React from "react";
import { Heading, Link, Section, Text } from "@react-email/components";
import  EmailLayout  from "../components/email-layout";

export default function MagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  return (
    <EmailLayout preview="Your secure sign-in link" email={email}>

      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Sign in to your account
      </Heading>

      <Text className="text-sm leading-6 text-black">
        Click the button below to securely sign in to your Boilercode account.
      </Text>

      <Section className="my-8">
        <Link
          href={url}
          className="inline-block bg-black px-6 py-3 text-center text-[13px] font-medium text-white no-underline"
        >
          Sign in
        </Link>
      </Section>

      <Text className="text-sm leading-6 text-black">
        If the button above doesn’t work, copy and paste this link into your browser:
      </Text>

      <Text className="break-all text-sm font-medium text-purple-600">
        {url.replace(/^https?:\/\//, "")}
      </Text>

      <Text className="text-sm leading-6 text-neutral-600">
        This link will expire in 10 minutes for security reasons.
      </Text>

      <Text className="text-sm leading-6 text-neutral-600">
        If you didn’t request this email, you can safely ignore it.
      </Text>

    </EmailLayout>
  );
}