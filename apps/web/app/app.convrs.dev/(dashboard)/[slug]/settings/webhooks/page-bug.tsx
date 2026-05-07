"use client";
import useWebhooks from "@/lib/swr/use-webhooks";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function WebhooksPage() {
  const router = useRouter();
  const { id: workspaceId, role } = useWorkspace();
  const { webhooks } = useWebhooks();

  return (
    <div>
      <div className="my-3">
        <Button
          className="text-white w-fit font-default text-[13px] h-fit py-1.5"
          text="Create New Webhook"
          onClick={() => {
            router.push(`/${workspaceId}/settings/webhooks/new`);
          }}
        />
      </div>
      {webhooks &&
        webhooks.length > 0 &&
        webhooks.map((webhook: any) => (
          <div
            key={webhook.id}
            className="p-4 border rounded mb-2 cursor-pointer"
            onClick={() =>
              router.push(`/${workspaceId}/settings/webhooks/${webhook.id}`)
            }
          >
            <h3 className="text-[15px] font-default font-semibold">{webhook.name}</h3>
            <p className="text-sm text-gray-500 font-default">{webhook.url}</p>
            <p className="text-sm text-gray-500 font-default">
              Triggers: {webhook.triggers.join(", ")}
            </p>
          </div>
        ))}
      {webhooks?.length === 0 && (
        <div className="mx-auto max-w-md text-center py-12">
          <h3 className="text-lg font-semibold font-default text-gray-900 mb-2">
            No webhooks yet
          </h3>
          <p className="text-sm font-default text-gray-500 leading-relaxed">
            Webhooks allow you to receive real-time notifications about events
            in your workspace. Create a webhook to get notified when a new
            workspace is created, updated, or deleted.
          </p>
        </div>
      )}
    </div>
  );
}
