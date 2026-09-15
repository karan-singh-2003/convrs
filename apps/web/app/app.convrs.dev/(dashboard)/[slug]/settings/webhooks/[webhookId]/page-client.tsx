"use client";

// import { clientAccessCheck } from "@/lib/client-access-check";
import useWorkspace from "@/lib/swr/use-workspace";
import { WebhookEventProps } from "@/lib/types";
// import { WebhookEventListSkeleton } from "@/ui/webhooks/loading-events-skelton";
// import { NoEventsPlaceholder } from "@/ui/webhooks/no-events-placeholder";
import { WebhookEventList } from "@/ui/webhook/webhook-events";
import { MaxWidthWrapper } from "@/ui/layout/max-width-wrapper";
import { fetcher } from "@repo/utils";
import { redirect } from "next/navigation";
import useSWR from "swr";

export default function WebhookLogsPageClient({
  webhookId,
}: {
  webhookId: string;
}) {
  const { slug, role, id: workspaceId } = useWorkspace();

  // const { error: permissionsError } = clientAccessCheck({
  //   action: "webhooks.read",
  //   role,
  // });

  // if (permissionsError) {
  //   redirect(`/${slug}/settings`);
  // }

  const { data: events, isLoading } = useSWR<WebhookEventProps[]>(
    webhookId && workspaceId
      ? `/api/webhooks/${webhookId}/events?workspaceId=${workspaceId}`
      : null,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  return (
    <MaxWidthWrapper className="max-w-screen-lg space-y-6">
      {events && events.length === 0 && (
        <div className="mx-auto max-w-md text-center py-12">
          <h3 className="text-lg font-semibold font-default text-gray-900 mb-2">
            No events yet
          </h3>
          <p className="text-sm font-default text-gray-500 leading-relaxed">
            Webhook events will appear here when your webhook receives requests.
            You can use the "Send Test Webhook" feature to trigger test events
            and see them appear in this list.
          </p>
        </div>
      )}
      <WebhookEventList events={events || []} />
    </MaxWidthWrapper>
  );
}
