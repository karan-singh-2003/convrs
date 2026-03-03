"use client";
import useWebhook from "@/lib/swr/use-webhook";
import useWorkspace from "@/lib/swr/use-workspace";
import { ArrowLeft, Ellipsis } from "lucide-react";
import Link from "next/link";
import { TokenAvatar } from "@repo/ui";
import { cn } from "@repo/utils";
import { WebhookProps } from "@/lib/types";
import { Popover, Button, TabSelect } from "@repo/ui";
import { useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useSendTestWebhookModal } from "../modals/send-test-webhook-modal";

export default function WebhookHeader({ webhookId }: { webhookId: string }) {
  const { webhook, isLoading } = useWebhook();
  const { slug } = useWorkspace();

  const [openPopover, setOpenPopover] = useState(false);

  const selectedLayoutSegment = useSelectedLayoutSegment();
  const page = selectedLayoutSegment === null ? "" : selectedLayoutSegment;

  const { setShowSendTestWebhookModal, SendTestWebhookModal } =
    useSendTestWebhookModal({
      webhook,
    });
  return (
    <>
      <SendTestWebhookModal />
      <div className="my-4 ">
        <Link
          href={`/${slug}/settings/webhooks`}
          className="flex items-center space-x-2"
        >
          {" "}
          <ArrowLeft size={16} strokeWidth={1} />
          <span className=" font-default font-medium text-neutral-600 text-[13px]">
            Back to Webhooks
          </span>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        {isLoading || !webhook ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-fit flex-none rounded-md bg-gradient-to-t from-neutral-100 p-2">
              <div className="size-8 rounded-full bg-neutral-100" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-5 w-28 rounded-full bg-neutral-100"></div>
              <div className="h-3 w-48 rounded-full bg-neutral-100"></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-fit flex-none rounded-none border border-neutral-200 bg-gradient-to-t from-neutral-100 p-2">
              <TokenAvatar id={webhook.id} className="size-8" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold font-default text-sm text-neutral-700">
                  {webhook.name}
                </span>
                <WebhookStatus webhook={webhook} />
              </div>
              <a
                href={webhook.url}
                target="_blank"
                className="line-clamp-1 text-pretty font-default break-all text-sm text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline"
              >
                {webhook.url}
              </a>
            </div>
          </div>
        )}
        <Popover
          openPopover={openPopover}
          setOpenPopover={setOpenPopover}
          content={
            <div className="flex flex-col w-full">
              <Button
                text="Send Test Event"
                variant="secondary"
                className="h-9 text-[12.5px] font-default"
                onClick={() => {
                  setShowSendTestWebhookModal(true);
                  setOpenPopover(false);
                }}
              />
              <Button
                text="Delete Webhook"
                variant="danger-outline"
                className="h-9 text-[12.5px] font-default"
              />
              <Button
                text="Disable Webhook"
                variant="secondary"
                className="h-9 text-[12.5px] font-default"
              />
            </div>
          }
        >
          <Button
            variant="outline"
            icon={<Ellipsis className="h-5 w-5 shrink-0 text-neutral-500" />}
            className="rounded-full h-8 w-8 min-h-0 border-neutral-200"
            onClick={() => {
              setOpenPopover(true);
            }}
          ></Button>
        </Popover>
      </div>
      <div className="-ml-1.5 border-b border-neutral-200">
        <TabSelect
          options={[
            {
              id: "",
              label: "Event Logs",
              href: `/${slug}/settings/webhooks/${webhookId}`,
            },
            {
              id: "edit",
              label: "Configuration",
              href: `/${slug}/settings/webhooks/${webhookId}/edit`,
            },
          ]}
          selected={page}
          className="gap-2 font-default text-[13.5px] text-neutral-600 font-medium "
        />
      </div>
    </>
  );
}

export const WebhookStatus = ({
  webhook,
}: {
  webhook: Pick<WebhookProps, "disabledAt">;
}) => {
  const { disabledAt } = webhook;

  return (
    <span
      className={cn(
        "inline-flex font-default rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-red-100 text-red-500": disabledAt,
          "bg-green-100 text-green-500": !disabledAt,
        }
      )}
    >
      {disabledAt ? "Disabled" : "Enabled"}
    </span>
  );
};
