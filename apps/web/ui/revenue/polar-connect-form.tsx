// apps/web/ui/workspaces/revenue/polar-connect-form.tsx
"use client";
import { Button, Input } from "@repo/ui";
import { ArrowRight } from "lucide-react";
import { FormState } from "./provider-config";

export function PolarConnectForm({
  form,
  setForm,
  onConnect,
  connecting,
  isValid,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onConnect: () => void;
  connecting: boolean;
  isValid: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[15px] font-medium text-content-default">
          2. Connect your Polar account
        </h2>
        <p className="mt-0.5 font-medium font-display text-sm text-content-subtle">
          Enter your Organization ID and Access Token to connect Polar.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            Organization ID
          </label>
          <Input
            placeholder="your-organization-id"
            value={form.organizationId}
            onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
            className="h-11 "
          />
          <p className="mt-2 font-medium font-display text-sm text-content-subtle">
            Polar Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Settings <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            General <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Profile <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Copy the <span className="font-medium">Identifier</span>.
          </p>
        </div>

        <div>
          <label className="mb-2 block font-display text-sm font-medium text-content-default">
            Access Token
          </label>
          <Input
            placeholder="polar_oat_********************"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className="h-11 "
          />
          <p className="mt-2 font-medium font-display text-sm text-content-subtle">
            Polar Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Settings <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            General <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
            Tokens
            <br />
            Create a token with <span className="font-medium">No Expiration</span> and enable only:
            <span className="font-medium"> checkout:read, orders:read, organization:read, products:read, subscriptions:read, webhook:write</span>.
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