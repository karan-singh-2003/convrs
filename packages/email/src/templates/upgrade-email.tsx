import React from "react";
import { Heading, Section, Text, Img } from "@react-email/components";
import  EmailLayout  from "../components/email-layout";
import { getPlanDetails } from "@repo/utils";

export default function UpgradeEmail({
  name,
  email,
  plan,
}: {
  name: string | null;
  email: string;
  plan: string;
}) {
  const planDetails = getPlanDetails({ plan });

  return (
    <EmailLayout preview={`Thank you for upgrading to Boilercode ${plan}!`} email={email}>

      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        Thank you for upgrading to Boilercode {plan}!
      </Heading>

      <Section className="my-8">
        <Img
          src="https://boilercode.dev/thank-you.png"
          alt="Thank you"
          style={{ maxWidth: "500px" }}
        />
      </Section>

      <Text className="text-sm leading-6 text-black">
        Hey{name && ` ${name}`}!
      </Text>

      <Text className="text-sm leading-6 text-black">
        I’m Karan, the creator of Boilercode.
      </Text>

      <Text className="text-sm leading-6 text-black">
        Thank you for upgrading to <strong>Boilercode {plan}</strong>. Your
        support helps us continue building high-quality SaaS starter templates.
      </Text>

      <Text className="text-sm leading-6 text-black">
        On the {plan} plan, you now have access to:
      </Text>

      {planDetails.plan?.features?.map((feature) => (
        <Text
          key={feature.name}
          className="ml-1 text-sm leading-5 text-black"
        >
          ✦ {feature.name}
        </Text>
      ))}

      <Text className="text-sm leading-6 text-black">
        If you have any questions or feedback, feel free to reply to this email.
      </Text>

      <Text className="text-sm leading-6 text-neutral-500">
        — Karan, Boilercode
      </Text>

    </EmailLayout>
  );
}