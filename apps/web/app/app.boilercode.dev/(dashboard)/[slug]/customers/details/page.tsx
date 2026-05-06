"use client";

import React, { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import useCustomer from "@/lib/swr/use-customer";
import useCustomerActivity, {
  type ActivityEvent,
} from "@/lib/swr/use-customer-activity";
import { LogIn } from "lucide-react";
import useWorkspace from "@/lib/swr/use-workspace";
import { LoadingSpinner } from "@repo/ui";
import { COUNTRIES } from "@repo/utils";

type CustomerDetails = {
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
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : fullDateFormatter.format(parsed);
};

const formatRelativeDays = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const diffMs = Date.now() - parsed.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const formatAmount = (value: number) =>
  currencyFormatter.format((value || 0) / 100);

const formatTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : shortTimeFormatter.format(parsed);
};

const getTimeToSale = (customer: CustomerDetails | null) => {
  if (!customer?.createdAt || !customer.firstSaleAt) return "-";
  const createdAt = new Date(customer.createdAt).getTime();
  const firstSaleAt = new Date(customer.firstSaleAt).getTime();
  if (
    Number.isNaN(createdAt) ||
    Number.isNaN(firstSaleAt) ||
    firstSaleAt < createdAt
  ) {
    return "-";
  }
  const days = Math.floor((firstSaleAt - createdAt) / (1000 * 60 * 60 * 24));
  return `${days} day${days === 1 ? "" : "s"}`;
};

export default function CustomerDetailsPage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const { customer, loading: isLoading } = useCustomer(customerId);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (date: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const { id: workspaceId } = useWorkspace();
  const { activity, isLoading: activityLoading } = useCustomerActivity(
    customerId,
    workspaceId || null
  );

  function RevenueIcon() {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="size-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    );
  }
  function formatRevenue(revenue: number | null, currency: string | null) {
    if (!revenue) return null;
    // revenue is stored in smallest unit (e.g. paise/cents), divide by 100
    const amount = revenue / 100;
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // fallback if currency code is invalid
      return `${currency || "$"}${amount.toFixed(2)}`;
    }
  }

  // icon + label helpers
  function eventIcon(ev: ActivityEvent) {
    if (ev.event_type === "revenue") return <RevenueIcon />;
    if (ev.event_type === "pageview")
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    if (ev.event_name === "identify") return <LogIn size={16} />;
    if (ev.event_type === "goals")
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide size-[17px] lucide-crosshair-icon lucide-crosshair"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="22" x2="18" y1="12" y2="12" />
          <line x1="6" x2="2" y1="12" y2="12" />
          <line x1="12" x2="12" y1="6" y2="2" />
          <line x1="12" x2="12" y1="22" y2="18" />
        </svg>
      );
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.25 9.75L9.75 2.25M9.75 2.25V7.875M9.75 2.25H4.125"
          stroke="#969696"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function eventTitle(ev: ActivityEvent) {
    if (ev.event_type === "revenue") {
      const formatted = formatRevenue(ev.revenue, ev.currency);
      return formatted ? `Paid ${formatted}` : ev.event_name.replace(/_/g, " ");
    }
    if (ev.event_type === "pageview")
      return `Visited ${ev.page ?? ev.url ?? "a page"}`;
    if (ev.event_name === "identify") return "Identified as user";
    return ev.event_name.replace(/_/g, " ");
  }

  const metrics = [
    {
      label: "First Sale date",
      value: formatDate(customer?.firstSaleAt ?? null),
    },
    { label: "Time to sale", value: getTimeToSale(customer) },
    { label: "Lifetime Value", value: formatAmount(customer?.saleAmount ?? 0) },
    {
      label: "Subscription Cancelled",
      value: formatDate(customer?.subscriptionCanceledAt ?? null),
    },
  ];

  const displayName = customer?.name || "Unnamed customer";
  const displayEmail = customer?.email;
  const displayAvatar =
    customer?.avatar ||
    `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
      customer?.name || customer?.email || customer?.id || "customer"
    )}`;

  const countryCode =
    Object.entries(COUNTRIES)
      .find(([, name]) => name === customer?.country)?.[0]
      ?.toLowerCase() || "unknown";

  if (!customerId) {
    return (
      <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
        <div className="rounded-2xl font-display bg-[#fafafa] p-4 text-sm text-neutral-400">
          Missing customerId in URL. Open a customer from the customers list.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
        <div className="rounded-2xl font-display   p-4 text-sm text-neutral-400">
          <LoadingSpinner></LoadingSpinner>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
        <div className="rounded-2xl font-display bg-[#fafafa] p-4 text-sm text-neutral-400">
          Customer not found.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-lg mx-auto px-3 sm:px-0 space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:sticky md:top-0 z-10 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-[#fafafa] p-2 rounded-[18px]">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-[16px] space-y-1 px-4 sm:px-6 py-5 min-h-24"
          >
            <p className="text-[14px] font-display text-neutral-400">
              {item.label}
            </p>
            <p className="text-lg sm:text-xl font-bricolageGrotesque font-medium text-neutral-600 break-words">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Activity — scrollable only */}
        <div className="lg:col-span-2 relative space-y-6 order-2 px-4 lg:order-1 ">
          <h2 className="text-[14.5px] font-medium font-display text-neutral-500">
            Activity
          </h2>

          {activityLoading ? (
            <p className="text-sm font-display text-neutral-400">
              Loading activity...
            </p>
          ) : activity.length === 0 ? (
            <p className="text-sm font-display text-neutral-400">
              No activity recorded yet.
            </p>
          ) : (
            activity.map((group) => (
              <div
                key={group.date}
                className="space-y-3 md:overflow-y-auto scrollbar-hide max-h-[600px]"
              >
                <p
                  className="text-[14.5px] font-display font-medium flex items-center gap-x-2 text-neutral-400 cursor-pointer"
                  onClick={() => toggleGroup(group.date)}
                >
                  {group.date}
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${
                      openGroups[group.date] ? "rotate-180" : ""
                    }`}
                  />
                </p>

                {openGroups[group.date] && (
                  <div className="bg-white rounded-2xl pt-2 space-y-5 font-display">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-1"
                      >
                        <div className="flex items-center gap-x-3 text-neutral-500">
                          {eventIcon(item)}
                          <div>
                            <p
                              className={`font-display font-medium text-[14px] ${
                                item.event_type === "revenue"
                                  ? "text-emerald-600"
                                  : "text-neutral-600"
                              }`}
                            >
                              {eventTitle(item)}
                            </p>

                            {item.referer &&
                              item.referer !== "(direct)" &&
                              item.referer.startsWith("http") && (
                                <p className="text-xs text-neutral-400">
                                  via {item.referer}
                                </p>
                              )}

                            {item.utm_campaign && (
                              <p className="text-xs text-neutral-400">
                                campaign: {item.utm_campaign}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-neutral-400 whitespace-nowrap">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sticky customer card */}
        <div className="md:relative  top-4 order-1 lg:order-2">
          <div className="bg-white border border-neutral-100 rounded-[24px] sm:rounded-[34px] p-5 sm:p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)]">
            {/* Avatar + Name */}
            <div className="flex flex-row items-center md:items-start md:flex-col gap-3">
              <img
                src={displayAvatar}
                className="md:h-16 md:w-16 h-8 w-8 rounded-full"
                alt={displayName}
              />
              <h3 className="font-medium md:text-[20px] text-base text-neutral-600">
                {displayName}
              </h3>
            </div>

            {/* Info */}
            <div className="border-t font-display pt-4 space-y-3 text-sm text-neutral-500">
              {displayEmail && (
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"
                    />
                  </svg>
                  <span className="text-neutral-600 break-all">
                    {displayEmail}
                  </span>
                </div>
              )}

              {customer?.country && (
                <div className="flex items-center gap-2">
                  <img
                    alt={customer.country}
                    src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
                    className="size-5 shrink-0"
                  />
                  <span className="font-default font-medium text-neutral-600">
                    {customer.country || "-"}
                  </span>
                </div>
              )}

              <div className="flex font-medium font-default items-center gap-2">
                <Activity size={16} />
                <span className="text-neutral-600">
                  {formatRelativeDays(customer.updatedAt || customer.createdAt)}
                </span>
              </div>
            </div>

            {/* IDs */}
            <div className="border-t pt-4 space-y-3 font-display">
              <div className="flex flex-col gap-y-2 text-sm">
                <span className="text-neutral-400">User ID</span>
                <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-1 rounded-md">
                  {customer.externalId || customer.id}
                </span>
              </div>

              {customer.stripeCustomerId && (
                <div className="flex flex-col gap-y-2 text-sm">
                  <span className="text-neutral-400">Stripe Customer</span>
                  <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-1 rounded-md">
                    {customer.stripeCustomerId || "-"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom lift shadow */}
          <div className="pointer-events-none absolute inset-x-6 -bottom-4 h-8 bg-black/10 blur-2xl rounded-full" />
        </div>
      </div>
    </div>
  );
}
