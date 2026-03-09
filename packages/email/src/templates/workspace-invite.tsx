import { Heading, Section, Text, Link } from "@react-email/components";
import React from "react";
import EmailLayout from "../components/email-layout";
import EmailButton from "../components/button";

export default function WorkspaceInvite({
  email,
  url,
  workspaceName,
  workspaceUser,
  workspaceUserEmail,
}: {
  email: string;
  url: string;
  workspaceName: string;
  workspaceUser: string | null;
  workspaceUserEmail: string | null;
}) {
  return (
    <EmailLayout preview={`Join ${workspaceName} on boilercode.dev`} email={email}>

      <Heading className="text-2xl font-medium text-black mt-6">
        Join {workspaceName}
      </Heading>

      {workspaceUser ? (
        <Text className="text-sm text-neutral-700">
          <strong>{workspaceUser}</strong> invited you to join the{" "}
          <strong>{workspaceName}</strong> workspace.
        </Text>
      ) : (
        <Text className="text-sm text-neutral-700">
          You were invited to join the <strong>{workspaceName}</strong> workspace.
        </Text>
      )}

      <Section className="mt-8 mb-8">
        <EmailButton href={url}>Join Workspace</EmailButton>
      </Section>

      <Text className="text-sm text-neutral-600">
        Or copy and paste this URL into your browser:
      </Text>

      <Text className="text-sm font-medium break-words text-black">
        {url}
      </Text>

    </EmailLayout>
  );
}