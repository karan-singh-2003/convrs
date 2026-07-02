"use client";
import useWorkspace from "@/lib/swr/use-workspace";
import useStripeIntegration from "@/lib/swr/use-stripe-integration";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Button, Input, ToggleGroup } from "@repo/ui";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";
import { LoadingSpinner } from "@repo/ui";

export default function RevenueSettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"dodo" | "stripe" | "Polar">(
    "dodo"
  );
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  const { id } = useWorkspace();
  const { connected, loading, mutate } = useStripeIntegration();

  async function handleConnect() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/integrations/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, workspaceId: id }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error || "Failed to connect";
        toast.error(message);
        setError(message);
        setStatus("error");
        return;
      }

      setStatus("done");
      toast.success("Stripe connected");
      setApiKey("");
      await mutate();
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }

  async function handleDisconnect() {
    if (!id) return;

    setDisconnecting(true);
    setError("");

    try {
      const res = await fetch("/api/integrations/stripe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error || "Failed to disconnect";
        toast.error(message);
        setError(message);
        return;
      }

      toast.success("Stripe disconnected");
      await mutate();
    } catch (e: any) {
      const message = e.message || "Failed to disconnect";
      setError(message);
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Revenue"
        description="Get insights into your revenue streams, track performance, and make data-driven decisions to grow your business with our comprehensive revenue analytics tools."
      >
        <div className="rounded-3xl bg-neutral-50 ">
          <ToggleGroup
            selected={provider}
            selectAction={(value) => setProvider(value as "dodo" | "stripe")}
            className="bg-neutral-100 w-full text-center border border-neutral-200"
            optionClassName="w-full px-3 py-1 text-center text-sm justify-center"
            options={[
              {
                value: "dodo",

                label: (
                  <span className="flex items-center gap-2">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 126 126"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-7 rounded-md corner-superellipse/1.25"
                    >
                      <rect width="125.378" height="125.338"></rect>
                      <path
                        d="M62.689 0C28.069 0 0 28.059 0 62.669C0 97.279 28.068 125.338 62.69 125.338C97.31 125.338 125.378 97.279 125.378 62.668C125.378 28.058 97.31 0 62.689 0Z"
                        fill="#C6FE1E"
                      ></path>
                      <path
                        d="M55.2079 46.274H55.1659C52.5759 45.531 49.8339 47.018 48.9559 49.474C47.9859 52.115 49.5239 55.14 52.2409 55.976C58.8939 57.864 61.7529 48.33 55.2079 46.274Z"
                        fill="#0D0D0D"
                      ></path>
                      <path
                        d="M111.912 59.753C103.345 40.993 76.0124 48.756 73.4884 43.843C66.0914 32.236 52.2824 25.719 37.3544 29.078C35.0554 28.158 27.1404 27.908 22.0244 31.125L25.1094 32.487C25.3434 32.587 25.2764 32.562 25.6194 32.687C27.0144 33.214 26.7724 33.064 25.7694 33.615C23.4704 34.96 20.6034 36.523 18.8154 38.871C18.8904 38.979 22.7524 39.907 22.7524 39.907C22.8184 39.924 23.5374 39.999 23.3794 40.317C10.7494 60.254 32.0464 90.343 42.3864 106.537H72.3184C67.6954 98.265 62.4134 86.976 64.2184 79.313C64.5444 77.926 64.9624 76.163 66.6674 75.929C70.7884 75.269 76.3054 75.328 80.2334 74.885H80.2924C81.1284 74.843 101.589 72.244 106.487 84.995C106.905 86.165 107.867 85.405 108.251 84.636C111.904 77.375 114.261 65.944 111.929 59.761L111.912 59.753ZM78.8794 53.594C77.4424 56.159 76.4644 59.494 76.2134 62.401C76.0794 64.248 76.2714 66.069 76.4554 67.916C76.5564 68.935 76.5644 70.222 75.7454 70.891C75.0344 71.492 73.8564 71.551 72.6694 71.634C66.8434 71.609 52.6334 71.634 47.1594 67.908L47.1254 67.883C39.1594 63.028 34.8964 52.065 39.6274 43.55C41.1574 40.66 43.9744 38.779 47.1844 38.069C51.3134 37.124 55.8604 37.826 59.5464 39.757C61.0504 40.517 62.8484 41.52 64.2184 42.673C66.9354 45.046 69.2584 47.511 72.8194 48.271C74.4584 48.739 76.1634 48.672 77.8014 49.007C80.8694 49.742 80.1004 51.488 78.8714 53.577L78.8794 53.594Z"
                        fill="#0D0D0D"
                      ></path>
                    </svg>
                    <span>Dodo Payments</span>
                    {/* <span className="text-[10px] px-2 py-0.5 rounded-full font-display bg-neutral-200 text-neutral-600">
                      Coming Soon
                    </span> */}
                  </span>
                ),
              },
              {
                value: "stripe",
                label: (
                  <span className="flex items-center gap-2">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 400 400"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-6 rounded-md corner-superellipse/1.25"
                    >
                      <circle cx="200" cy="200" r="200" fill="#635BFF"></circle>
                      <path
                        d="M184.401 155.5C184.401 146.1 192.101 142.4 204.901 142.4C223.301 142.4 246.501 148 264.901 157.9V101.1C244.801 93.1 225.001 90 205.001 90C155.901 90 123.301 115.6 123.301 158.4C123.301 225.1 215.201 214.5 215.201 243.3C215.201 254.4 205.501 258 192.001 258C171.901 258 146.301 249.8 126.001 238.7V296.2C148.501 305.9 171.201 310 192.001 310C242.301 310 276.901 285.1 276.901 241.8C276.501 169.8 184.401 182.6 184.401 155.5Z"
                        fill="white"
                      ></path>
                    </svg>
                    <span>Stripe</span>
                  </span>
                ),
              },
            ]}
          />

          <div className="mt-4 rounded-2xl  bg-white p-4 sm:p-5">
            {provider === "dodo" ? (
              <>
                <div className="flex flex-col items-center justify-center py-5 font-display text-center">
                  <h2 className="text-base font-medium text-neutral-600">
                    Dodo Payments
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 max-w-sm">
                    Dodo integration is currently under development and will be
                    available soon.
                  </p>

                  <div className="mt-4 px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 text-sm font-medium">
                    Coming Soon
                  </div>
                </div>
              </>
            ) : loading ? (
              <div className="py-4 text-sm font-medium text-neutral-500">
                <LoadingSpinner className="mx-auto" />
              </div>
            ) : connected ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-display text-[14.5px] font-medium text-neutral-600">
                  You have connected Stripe account
                </h2>
                <Button
                  text="Disconnect"
                  variant="danger"
                  className="h-7 w-fit rounded-full px-5 text-[13px] font-display"
                  onClick={handleDisconnect}
                  loading={disconnecting}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <>
                  <div>
                    <h2 className="font-display text-[15px] leading-tight font-medium text-neutral-600">
                      Restricted API Key
                    </h2>
                    <p className="mt-1 text-sm font-display font-medium text-neutral-500">
                      Create a restricted API Key and paste the API key below.
                      Create from{" "}
                      <Link
                        href={STRIPE_CONNECT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-800 underline underline-offset-2"
                      >
                        Stripe Dashboard
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 my-4 sm:flex-row sm:items-center">
                    <Input
                      placeholder="rk_live_***************"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-11 bg-neutral-50"
                    />
                    <Button
                      text="Connect"
                      className="h-11 w-full rounded-full px-6 sm:w-fit"
                      onClick={handleConnect}
                      loading={status === "loading"}
                      disabled={!apiKey.trim() || status === "loading"}
                    />
                  </div>
                </>
              </div>
            )}
          </div>

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}

export const STRIPE_CONNECT_URL =
  "https://dashboard.stripe.com/apikeys/create" +
  "?name=Convrs" +
  "&permissions[]=rak_account_read" +
  "&permissions[]=rak_charge_read" +
  "&permissions[]=rak_subscription_read" +
  "&permissions[]=rak_customer_read" +
  "&permissions[]=rak_payment_intent_read" +
  "&permissions[]=rak_checkout_session_read" +
  "&permissions[]=rak_invoice_read" +
  "&permissions[]=rak_webhook_write" +
  "&permissions[]=rak_product_read";
