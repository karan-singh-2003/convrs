// apps/web/ui/workspaces/revenue/paddle-connect-form.tsx
"use client";
import { Button, Input } from "@repo/ui";
import { ArrowRight } from "lucide-react";
import { FormState } from "./provider-config";

export function PaddleConnectForm({
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
          2. Connect your Paddle account
        </h2>
        <p className="mt-0.5 font-medium font-display text-sm text-content-subtle">
          Create an API key in your Paddle dashboard, then paste it below.
        </p>
      </div>

      <div>
        <label className="mb-2 block font-display text-sm font-medium text-content-default">
          API Key
        </label>
        <Input
          placeholder="pdl_live_********************************"
          value={form.apiKey}
          onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          className="h-11 "
        />
        <p className="mt-2 font-display text-sm font-medium text-content-subtle leading-6">
          Paddle Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
          Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
          Tools <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
          Authentication
          <br />
          Create an API key with <span className="font-display font-medium">Never expires</span> and enable only{" "}
          <span className="font-display font-medium">Transactions (Read), Notification Settings (Read), and Notification Settings (Write)</span>.
        </p>
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