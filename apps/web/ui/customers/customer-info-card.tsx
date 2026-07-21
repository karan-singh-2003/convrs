import { Activity } from "lucide-react";
import { COUNTRIES } from "@repo/utils";
import { DeviceIcon } from "@/ui/analytics/device-icon";
import { formatRelativeDays } from "@/lib/customers/format";

export type CustomerDetails = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  externalId: string | null;
  stripeCustomerId: string | null;
  country: string | null;
  sales: number;
  saleAmount: number;
  firstSaleAt: string | null;
  subscriptionCanceledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  device: string | null;
  browser: string | null;
};

export function CustomerInfoCard({ customer }: { customer: CustomerDetails }) {
  const displayName = customer.name || "Unnamed customer";
  const displayEmail = customer.email;
  const displayAvatar =
    customer.avatar ||
    `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
      customer.name || customer.email || customer.id || "customer",
    )}`;

  const countryCode =
    Object.entries(COUNTRIES)
      .find(([, name]) => name === customer.country)?.[0]
      ?.toLowerCase() || "unknown";

  return (
    <div className="top-4 md:relative">
      <div className="space-y-4 rounded-[24px] border border-border-subtle bg-bg-card p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)] sm:rounded-[34px] sm:p-6">
        {/* Avatar */}
        <div className="flex flex-row items-center gap-3 md:flex-col md:items-start">
          <img
            src={displayAvatar}
            className="h-8 w-8 rounded-full md:h-16 md:w-16"
            alt={displayName}
          />
          <h3 className="text-base font-medium text-content-emphasis md:text-[20px]">
            {displayName}
          </h3>
        </div>

        {/* Info */}
        <div className="space-y-3 border-t border-border-subtle pt-4 font-display text-sm text-content-default">
          {displayEmail && (
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4 text-content-subtle"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"
                />
              </svg>
              <span className="break-all text-content-default">{displayEmail}</span>
            </div>
          )}

          {customer.country && (
            <div className="flex items-center gap-2">
              <img
                alt={customer.country}
                src={`https://flagcdn.com/w20/${countryCode}.png`}
                width={20}
              />
              <span className="font-default font-medium text-content-default">
                {customer.country || "-"}
              </span>
            </div>
          )}

          {customer.browser && (
            <div className="flex items-center gap-2 font-default font-medium text-content-default">
              <DeviceIcon
                display={customer.browser}
                tab="browsers"
                className="h-3 w-3 sm:h-[18px] sm:w-[18px]"
              />
              {customer.browser}
            </div>
          )}

          {customer.device && (
            <div className="flex items-center gap-2 font-default font-medium text-content-default">
              <DeviceIcon
                display={customer.device}
                tab="devices"
                className="h-3 w-3 sm:h-[18px] sm:w-[18px]"
              />
              {customer.device}
            </div>
          )}

          <div className="flex items-center gap-2 font-default font-medium text-content-default">
            <Activity size={16} className="text-content-subtle" />
            <span>{formatRelativeDays(customer.updatedAt || customer.createdAt)}</span>
          </div>
        </div>

        {/* IDs */}
        <div className="space-y-3 border-t border-border-subtle pt-4 font-display">
          <div className="flex flex-col gap-y-2 text-sm">
            <span className="text-content-subtle">User ID</span>
            <span className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-content-default">
              {customer.externalId || customer.id}
            </span>
          </div>

          {customer.stripeCustomerId && (
            <div className="flex flex-col gap-y-2 text-sm">
              <span className="text-content-subtle">Stripe Customer</span>
              <span className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-content-default">
                {customer.stripeCustomerId || "-"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-6 -bottom-4 h-8 rounded-full bg-black/10 blur-2xl dark:bg-white/10" />
    </div>
  );
}