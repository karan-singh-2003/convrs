import { AnimatedSizeContainer } from "@repo/ui";
import WebhookNewPageClient from "./page-client";
import { createWebhookSecretToken } from "@/lib/webhook/secret-token";
export default function WebhookNewPage() {
  return (
    <AnimatedSizeContainer height>
      <WebhookNewPageClient secretToken={createWebhookSecretToken()} />
    </AnimatedSizeContainer>
  );
}
