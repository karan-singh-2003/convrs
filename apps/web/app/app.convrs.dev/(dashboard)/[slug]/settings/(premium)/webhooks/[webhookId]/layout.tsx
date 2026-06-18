import WebhookHeader from "@/ui/webhook/webhook-header";

export default async function WebhookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ webhookId: string }>;
}) {
  const { webhookId } = await params;
  return (
    <div className="grid gap-4">
      <WebhookHeader webhookId={webhookId} /> {children}
    </div>
  );
}
