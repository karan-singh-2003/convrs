"use client";
import { CreateNewWebhookProps, WebhookProps } from "@/lib/types";
import { Label, Input, Button, CopyButton } from "@repo/ui";
import { useMemo, useState } from "react";
import { WEBHOOK_TRIGGERS } from "@/lib/webhook/constant";
import useWorkspace from "@/lib/swr/use-workspace";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { mutate } from "swr";

const defaultValues: CreateNewWebhookProps = {
  name: "",
  url: "",
  secret: "",
  triggers: [],
};

export default function AddEditWebhookForm({
  webhook,
  secretToken,
}: {
  webhook: WebhookProps | null;
  secretToken?: string;
}) {
  const router = useRouter();
  const { id: workspaceId, slug: workspaceSlug } = useWorkspace();
  const [data, setData] = useState<CreateNewWebhookProps | WebhookProps>(
    webhook || {
      ...defaultValues,
      ...(secretToken && { secret: secretToken }),
    }
  );
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(() => {
    if (webhook) {
      return {
        method: "PATCH",
        url: `/api/webhooks/${webhook.id}?workspaceId=${workspaceId}`,
        successMessage: "Webhook updated successfully",
      };
    } else {
      return {
        method: "POST",
        url: `/api/webhooks?workspaceId=${workspaceId}`,
        successMessage: "Webhook created successfully",
      };
    }
  }, [webhook, workspaceId]);

  const onsubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    setSaving(false);
    const result = await response.json();

    if (!response.ok) {
      toast.error(
        result.error?.message || result.error || "Something went wrong"
      );
      return;
    }

    // Update cache
    if (endpoint.method === "POST") {
      mutate(`/api/webhooks?workspaceId=${workspaceId}`);
      router.push(`/${workspaceSlug}/settings/webhooks`);
    } else {
      mutate(`/api/webhooks/${result.id}?workspaceId=${workspaceId}`, result);
    }

    toast.success(endpoint.successMessage);
  };
  return (
    <>
      <form className="space-y-4 my-4 max-w-xl mx-auto " onSubmit={onsubmit}>
        <div className="space-y-2 w-full">
          <Label htmlFor="name" className="flex items-center space-x-2">
            <h2 className="text-sm font-medium text-neutral-900">Name</h2>
          </Label>
          <div className="w-full">
            <Input
              required
              autoComplete="off"
              placeholder="Webhook Name"
              autoFocus
              value={data.name}
              className="w-full"
              onChange={(e) => setData({ ...data, name: e.target.value })}
            ></Input>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="url" className="flex items-center space-x-2">
            <h2 className="text-sm font-medium text-neutral-900">URL</h2>
          </Label>
          <div className="w-full">
            <Input
              required
              autoComplete="off"
              placeholder="Webhook URL"
              value={data.url}
              onChange={(e) => setData({ ...data, url: e.target.value })}
            ></Input>
          </div>
        </div>

        <div className="space-y-2 w-full">
          <Label htmlFor="secret" className="flex items-center space-x-2">
            <h2 className="text-sm font-medium text-neutral-900">
              Signing Secret
            </h2>
          </Label>
          <div className="flex items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2">
            <p className="text-nowrap font-mono text-sm text-neutral-500">
              {data.secret}
            </p>
            <div className="flex flex-col gap-2">
              <CopyButton value={data.secret} className="rounded-md" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-y-3 w-full">
          <Label htmlFor="triggers" className="flex flex-col gap-y-1.5">
            <h2 className="text-sm font-medium text-neutral-900">
              Workspace level events
            </h2>
            <span className="text-xs text-neutral-500">
              These events are triggered at the workspace level.
            </span>
          </Label>
          <div className="flex flex-col gap-2">
            {WEBHOOK_TRIGGERS.map((trigger) => (
              <div key={trigger} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={trigger}
                  name={trigger}
                  value={trigger}
                  checked={data.triggers.includes(trigger)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setData({
                        ...data,
                        triggers: [...data.triggers, trigger],
                      });
                    } else {
                      setData({
                        ...data,
                        triggers: data.triggers.filter((t) => t !== trigger),
                      });
                    }
                  }}
                />
                <label
                  htmlFor={trigger}
                  className="text-sm text-neutral-600 cursor-pointer select-none"
                >
                  {trigger}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          className="text-white w-full"
          text={webhook ? "Update Webhook" : "Create Webhook"}
          loading={saving}
          disabled={!data.name || !data.url || !data.triggers.length || saving}
        />
      </form>
    </>
  );
}
