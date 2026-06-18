import WebhookNewPageClient from "./page-client";
import { createWebhookSecretToken } from "@/lib/webhook/secret-token";
export default function WebhookNewPage() {
  return <WebhookNewPageClient secretToken={createWebhookSecretToken()} />;
}
