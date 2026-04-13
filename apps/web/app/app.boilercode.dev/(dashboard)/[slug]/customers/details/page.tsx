"use client";

import React, { useState } from "react";
import {
  Activity,
  ChevronDown,
  CircleArrowRight,
  Crosshair,
  MoveUpRight,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import useCustomer from "@/lib/swr/use-customer";

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

const activities = [
  {
    date: "5 March, 2026",
    items: [
      {
        title: "Visited Shipfast.st",
        icon: <MoveUpRight size={18} />,
        time: "02:13 am",
        browser: "chrome",
        duration: "12 min",
      },
    ],
  },
  {
    date: "4 March, 2026",
    items: [
      {
        title: "Paid $99 USD",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        ),
        time: "02:13 am",
        browser: "chrome",
        duration: "12 min",
      },
    ],
  },
  {
    date: "2 March, 2026",
    items: [
      {
        title: "Found Trustarm.com via Google",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            className="size-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        ),
        time: "02:13 am",
        browser: "chrome",
        duration: "12 min",
      },
      {
        title: "Sign up Success",
        icon: <Crosshair size={16} />,
        time: "02:13 am",
        browser: "chrome",
        duration: "12 min",
      },
      {
        title: "Viewed About Page",
        icon: <CircleArrowRight size={16} />,
        time: "02:13 am",
        browser: "chrome",
        duration: "12 min",
      },
    ],
  },
];

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
  const displayEmail = customer?.email || "No email";
  const displayAvatar =
    customer?.avatar ||
    `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
      customer?.name || customer?.email || customer?.id || "customer"
    )}`;

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
        <div className="rounded-2xl font-display bg-[#fafafa] p-4 text-sm text-neutral-400">
          Loading customer details...
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-[#fafafa] p-2 rounded-[18px]">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-[16px] space-y-1 px-4 sm:px-6 py-5 min-h-24"
          >
            <p className="text-[14px] font-display  text-neutral-400">
              {item.label}
            </p>
            <p className="text-lg sm:text-xl font-bricolageGrotesque font-medium text-neutral-600 break-words">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          <h2 className="text-[14.5px] font-medium font-display text-neutral-500">
            Activity
          </h2>

          {activities.map((group) => (
            <div key={group.date} className="space-y-3">
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
                <div className="bg-[#fafafa] space-y-1 py-1 rounded-2xl">
                  <div className=" py-0.5">
                    <h1 className="font-display font-medium text-neutral-500 text-sm px-4 ">
                      Direct
                    </h1>
                  </div>

                  {openGroups[group.date] && (
                    <div className="bg-white rounded-2xl p-4 space-y-6 font-display">
                      {group.items.map((item, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-x-3 text-neutral-500">
                              {item.icon}
                              <p className="text-neutral-500/85 font-medium text-[14px] sm:text-[15px]">
                                {item.title}
                              </p>
                            </div>

                            <div className="text-xs font-poppins text-neutral-400">
                              {customer.updatedAt
                                ? shortTimeFormatter.format(
                                    new Date(customer.updatedAt)
                                  )
                                : item.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className=" py-0.5">
                    <h1 className="font-display font-medium text-neutral-500 text-sm px-4 py-1">
                      Session lasted for {Math.max(1, customer.sales || 1) * 3}{" "}
                      min
                    </h1>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative order-1 lg:order-2">
          {/* Card */}
          <div className="bg-white border border-neutral-100 rounded-[24px] sm:rounded-[34px] p-5 sm:p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)]">
            {/* Avatar + Name */}
            <div className="flex flex-col gap-3">
              <img
                src={displayAvatar}
                className="h-16 w-16 rounded-full"
                alt={displayName}
              />

              <h3 className="font-medium text-[20px] text-neutral-600">
                {displayName}
              </h3>
            </div>

            {/* Info */}
            <div className="border-t font-display pt-4 space-y-3 text-sm text-neutral-500">
              {/* Email */}
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

              {/* Country */}
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">
                  {customer.country || "-"}
                </span>
              </div>

              {/* Activity */}
              <div className="flex items-center gap-2">
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

              <div className="flex flex-col gap-y-2 text-sm">
                <span className="text-neutral-400">Stripe Customer</span>
                <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-1 rounded-md">
                  {customer.stripeCustomerId || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Lift Shadow (THIS is the key) */}
          <div className="pointer-events-none absolute inset-x-6 -bottom-4 h-8 bg-black/10 blur-2xl rounded-full" />
        </div>
      </div>
    </div>
  );
}
