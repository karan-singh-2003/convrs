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
    <div className=" space-y-5 rounded-2xl  ">
      <div>
        <h2 className="font-display text-[15px] font-medium text-content-default">
          2. Connect your Stripe account
        </h2>
        <p className="mt-0.5 font-medium font-display text-sm text-content-subtle">
          Create a restricted API key in your <Link href={CONNECT_URLS.stripe} target="_blank" rel="noopener noreferrer" className="text-content-default underline underline-offset-2" > Stripe Dashboard </Link>, then paste it below.
        </p>
      </div>

      <div>
        <label className="mb-2 block font-display text-sm font-medium text-content-default">
          Restricted API Key
        </label>

        <Input
          placeholder="rk_live_********************************"
          value={form.apiKey}
          onChange={(e) =>
            setForm((f) => ({ ...f, apiKey: e.target.value }))
          }
          className="h-11 "
        />

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