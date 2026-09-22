// apps/web/ui/workspaces/revenue/dodo-connect-form.tsx
"use client";
import { Button, Input } from "@repo/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CONNECT_URLS, FormState } from "./provider-config";

export function DodoConnectForm({
  form,
  setForm,
  onConnect,
  connecting,
  isValid,
  workspaceId,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onConnect: () => void;
  connecting: boolean;
  isValid: boolean;
  workspaceId?: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[15px] font-medium text-content-default">
          2. Connect your Dodo Payments account
        </h2>
        <p className="mt-0.5 font-medium font-display text-sm text-content-subtle">
          Dodo doesn't yet list Convrs in its integration marketplace, so
          set up a custom webhook instead — it takes about a minute.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-bg-subtle p-1 font-display text-sm text-content-subtle leading-6">
          <p className="font-medium text-content-default">1. Create a webhook endpoint</p>
          <p className="mt-1 text-content-subtle">
            Dodo Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Webhooks <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Add endpoint <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            choose <span className="font-medium">Custom</span> (not a marketplace integration).
          </p>
          <p className="mt-2 text-content-subtle">
            Set the URL to:
          </p>
          <code className="mt-1 block break-all rounded-md border border-border-subtle bg-bg-default px-3 py-2 text-[13px] text-content-default">
            {`https://app.convrs.dev/api/dodo/webhook/${workspaceId ?? "{workspaceId}"}`}
          </code>
          <p className="mt-2 text-content-subtle">
            Subscribe it to the <span className="font-medium">payment.succeeded</span> event, then copy the signing secret Dodo generates.
          </p>
        </div>

        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            Webhook signing secret
          </label>
          <Input
            placeholder="whsec_********************************"
            value={form.webhookSecret}
            onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
            className="h-11 "
          />
        </div>

        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            API Key <span className="font-normal text-content-subtle">(optional)</span>
          </label>
          <Input
            placeholder="Only needed if you want us to back-fill past payments"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className="h-11 "
          />
          <p className="mt-2 font-display text-sm text-content-subtle">
            From{" "}
            <Link
              href={CONNECT_URLS.dodo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-default underline underline-offset-2"
            >
              Dodo Payments settings
            </Link>
            . Attribution works from the webhook alone — this key only
            enables optional historical backfill.
          </p>
        </div>
      </div>
      <Button
        text="Connect"
        variant={"settings"}
        className="
    h-11
    w-full
    rounded-xl
    font-display
    font-medium
    transition-all
    hover:opacity-90
    active:scale-[0.99]
    disabled:opacity-50
    disabled:hover:opacity-50
  "
        onClick={onConnect}
        loading={connecting}
        disabled={!isValid || connecting}
      />
    </div>
  );
}
