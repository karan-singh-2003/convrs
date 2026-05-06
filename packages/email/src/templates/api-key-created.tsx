import React from "react";
import {
  Heading,
  Link,
  Preview,
  Section,
  Text as EmailText,
} from "@react-email/components";
import EmailLayout from "../components/email-layout";
import { formatDate } from "@repo/utils";

export const PreviewProps = {
  email: "user@example.com",
  workspace: {
    name: "Example Workspace",
    slug: "example-workspace",
  },
  token: {
    name: "Main API Key",
    type: "read-only",
    permissions: "read-only access to analytics",
  },
};

export default function APIKeyCreatedEmail({
  email = "",
  workspace = { name: "", slug: "" },
  token = { name: "", type: "", permissions: "" },
}: {
  email?: string;
  workspace?: {
    name: string;
    slug: string;
  };
  token?: {
    name: string;
    type: string;
    permissions: string;
  };
}) {
  return (
    <EmailLayout preview="New Workspace API Key Created" email={email}>
      <Heading className="mx-0 my-7 text-lg font-medium text-black">
        New Workspace API Key Created
      </Heading>

      <EmailText className="text-sm leading-6 text-black">
        You've created a new API key for your workspace{" "}
        <strong>{workspace.name}</strong> with the name{" "}
        <strong>"{token.name}"</strong> on {formatDate(new Date().toString())}.
      </EmailText>

      <EmailText className="text-sm leading-6 text-black">
        Since this is a <strong>{token.type}</strong> token, it has{" "}
        {token.permissions}.
      </EmailText>

      <Section className="my-8">
        <Link
          className="inline-block bg-black px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
          href={`https://app.dub.co/${workspace.slug}/settings/tokens`}
        >
          View API Keys
        </Link>
      </Section>

      <EmailText className="text-sm leading-6 text-black">
        If you did not create this API key, you can{" "}
        <Link
          href={`https://app.dub.co/${workspace.slug}/settings/tokens`}
          className="text-black underline"
        >
          <strong>delete this key</strong>
        </Link>{" "}
        from your account.
      </EmailText>
    </EmailLayout>
  );
}
