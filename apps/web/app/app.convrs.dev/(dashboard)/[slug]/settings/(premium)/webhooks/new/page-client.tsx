import AddEditWebhookForm from "@/ui/webhook/add-edit-webhook-form";

export default function WebhookNewPageClient({
  secretToken,
}: {
  secretToken: string;
}) {
  return (
    <div>
      <AddEditWebhookForm secretToken={secretToken} webhook={null} />
    </div>
  );
}
