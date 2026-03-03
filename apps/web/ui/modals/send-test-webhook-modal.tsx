import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { WebhookProps, WebhookTrigger } from "@/lib/types";
import { Modal } from "@repo/ui";
import { WEBHOOK_TRIGGERS } from "@/lib/webhook/constant";
import { Button } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { useAction } from "next-safe-action/hooks";
import { sendTestWebhook } from "@/lib/actions/send-test-webhook";
import { toast } from "sonner";

function TestWebhookModal({
  showSendTestWebhookModal,
  setShowSendTestWebhookModal,
  webhook,
}: {
  showSendTestWebhookModal: boolean;
  setShowSendTestWebhookModal: Dispatch<SetStateAction<boolean>>;
  webhook: WebhookProps | undefined;
}) {
  const [selectedTriggers, setSelectedTriggers] = useState<WebhookTrigger[]>(
    []
  );

  const triggers = Object.entries(WEBHOOK_TRIGGERS).map(([key, value]) => ({
    value: value as WebhookTrigger,
    label: value,
  }));

  const { id: workspaceId } = useWorkspace();
  const { execute, isPending } = useAction(sendTestWebhook, {
    onSuccess: () => {
      toast.success("Test webhook sent successfully");
      setShowSendTestWebhookModal(false);
    },
    onError: ({ error }) => {
      console.error("Error sending test webhook:", error);
      toast.error("Failed to send test webhook: " + error);
    },
  });

  return (
    <Modal
      showModal={showSendTestWebhookModal}
      setShowModal={setShowSendTestWebhookModal}
    >
      <div className="flex flex-col">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h3 className="text-lg font-semibold text-neutral-900">
            Send test webhook event
          </h3>
          <p className="mt-1 text-sm font-default text-neutral-500">
            Choose one or more webhook events to send to your receiver endpoint
          </p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            execute({
              webhookId: webhook?.id || "",
              triggers: selectedTriggers,
              workspaceId: workspaceId || "",
            });
          }}
        >
          <div className="bg-neutral-50 p-4 sm:p-6">
            <p className="text-sm font-default text-neutral-800">
              Select one or more webhook events to send to your receiver
              endpoint
            </p>

            <div className="mt-4">
              {triggers.map((trigger) => (
                <div
                  key={trigger.value}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="checkbox"
                    id={trigger.value}
                    name="webhook-trigger"
                    value={trigger.value}
                    checked={selectedTriggers.includes(trigger.value)}
                    className="h-4 w-4 rounded-none border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                    onChange={() => {
                      setSelectedTriggers((prev) =>
                        prev.includes(trigger.value)
                          ? prev.filter((t) => t !== trigger.value)
                          : [...prev, trigger.value]
                      );
                    }}
                  />
                  <label
                    htmlFor={trigger.value}
                    className="text-sm font-default text-neutral-600 cursor-pointer select-none"
                  >
                    {trigger.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-5 sm:px-6">
            <Button
              onClick={() => setShowSendTestWebhookModal(false)}
              variant="secondary"
              text="Cancel"
              className="h-8 w-fit px-3"
            />
            <Button
              disabled={selectedTriggers.length === 0}
              text="Send test webhook"
              className="h-8 w-fit px-3 text-white"
              loading={isPending}
            />
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function useSendTestWebhookModal({
  webhook,
}: {
  webhook: WebhookProps | undefined;
}) {
  const [showSendTestWebhookModal, setShowSendTestWebhookModal] =
    useState(false);

  const SendTestWebhookModalCallback = useCallback(() => {
    return (
      <TestWebhookModal
        showSendTestWebhookModal={showSendTestWebhookModal}
        setShowSendTestWebhookModal={setShowSendTestWebhookModal}
        webhook={webhook}
      />
    );
  }, [showSendTestWebhookModal, setShowSendTestWebhookModal]);

  return useMemo(
    () => ({
      setShowSendTestWebhookModal,
      SendTestWebhookModal: SendTestWebhookModalCallback,
    }),
    [setShowSendTestWebhookModal, SendTestWebhookModalCallback]
  );
}
