// apps/web/ui/workspaces/revenue/stripe-connect-form.tsx
"use client";
import { Button, Input } from "@repo/ui";
import Link from "next/link";
import { CONNECT_URLS, FormState } from "./provider-config";

export function StripeConnectForm({
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
    <div className=" space-y-5 rounded-2xl bg-white ">
      <div>
        <h2 className="font-display text-[15px] font-medium text-neutral-600">
          Connect your Stripe account
        </h2>
        <p className="mt-0.5 font-medium font-display text-sm text-neutral-500">
          Create a restricted API key in your <Link href={CONNECT_URLS.stripe} target="_blank" rel="noopener noreferrer" className="text-neutral-600 underline underline-offset-2" > Stripe Dashboard </Link>, then paste it below.
        </p>
      </div>

      <div>
        <label className="mb-2 block font-display text-sm font-medium text-neutral-600">
          Restricted API Key
        </label>

        <Input
          placeholder="rk_live_********************************"
          value={form.apiKey}
          onChange={(e) =>
            setForm((f) => ({ ...f, apiKey: e.target.value }))
          }
          className="h-11 bg-neutral-50"
        />

      </div>

      <Button
        text="Connect"
        className="h-11 w-full rounded-lg"
        onClick={onConnect}
        loading={connecting}
        disabled={!isValid || connecting}
      />
    </div>
  );
}