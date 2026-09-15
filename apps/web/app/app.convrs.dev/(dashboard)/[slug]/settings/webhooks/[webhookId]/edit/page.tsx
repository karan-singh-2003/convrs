import { AnimatedSizeContainer } from "@repo/ui";
import UpdateWebhookPageClient from "./page-client";

export default async function UpdateWebhookPage(props: {
  params: Promise<{ webhookId: string }>;
}) {
  const params = await props.params;
  const { webhookId } = params;

  return (
    <AnimatedSizeContainer height>
      <UpdateWebhookPageClient webhookId={webhookId} />
    </AnimatedSizeContainer>
  );
}
