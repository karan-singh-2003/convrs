// apps/web/ui/workspaces/revenue/lemonsqueezy-connect-form.tsx
"use client";
import { Button, Input } from "@repo/ui";
import Link from "next/link";
import { CONNECT_URLS, FormState } from "./provider-config";

export function LemonSqueezyConnectForm({
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
          Connect your Lemon Squeezy account
        </h2>
        <p className="mt-0.5  font-medium font-display text-sm text-content-subtle">
          Find your Store ID and create an API key, then paste them below.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            Store ID
          </label>
          <Input
            placeholder="123456"
            value={form.storeId}
            onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
            className="h-11 "
          />
        </div>

        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            API Key
          </label>
          <Input
            placeholder="sk_********************************"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className="h-11 "
          />
          <p className="mt-2 font-display font-medium text-sm text-content-subtle">
            Create from{" "}
            <Link
              href={CONNECT_URLS.lemonsqueezy}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 underline underline-offset-2"
            >
              LemonSqueezy API settings
            </Link>.
          </p>
        </div>


      </div>

      <Button
        text="Connect"
        className="
    h-11
    w-full
    rounded-xl
    font-display
    font-medium
    transition-all
    bg-bg-inverted
    text-content-inverted
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