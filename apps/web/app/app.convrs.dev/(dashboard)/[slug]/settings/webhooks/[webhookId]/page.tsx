import { AnimatedSizeContainer } from "@repo/ui";
import WebhookEventsClientPage from "./page-client";

export default async function WebhookEventsPage(props: {
  params: Promise<{ webhookId: string }>;
}) {
  const params = await props.params;
  const { webhookId } = params;
  return (
    <AnimatedSizeContainer height>
      <WebhookEventsClientPage webhookId={webhookId} />
    </AnimatedSizeContainer>
  );
}
