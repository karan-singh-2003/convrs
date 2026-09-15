// "use client";

// import { useMemo } from "react";
// import { useSearchParams } from "next/navigation";
// import useCustomer from "@/lib/swr/use-customer";
// import useCustomerActivity from "@/lib/swr/use-customer-activity";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { LoadingSpinner } from "@repo/ui";
// import {
//   DEFAULT_TIMEZONE,
//   formatDate,
//   formatAmount,
//   getTimeToSale,
// } from "@/lib/customers/format";
// import { ActivitySection } from "@/ui/customers/activity-section";
// import { CustomerMetrics, type Metric } from "@/ui/customers/customer-metrics";
// import { CustomerInfoCard } from "@/ui/customers/customer-info-card";

// export default function CustomerDetailsPage() {
//   const searchParams = useSearchParams();
//   const customerId = searchParams.get("customerId");
//   const { customer, loading: isLoading } = useCustomer(customerId);
//   const { id: workspaceId, timezone } = useWorkspace();
//   const tz = timezone || DEFAULT_TIMEZONE;

//   const fullDateFormatter = useMemo(
//     () =>
//       new Intl.DateTimeFormat("en-US", {
//         month: "short",
//         day: "numeric",
//         year: "numeric",
//         timeZone: tz,
//       }),
//     [tz],
//   );

//   const shortTimeFormatter = useMemo(
//     () =>
//       new Intl.DateTimeFormat("en-US", {
//         hour: "2-digit",
//         minute: "2-digit",
//         timeZone: tz,
//       }),
//     [tz],
//   );

//   const { activity, isLoading: activityLoading } = useCustomerActivity(
//     customerId,
//     workspaceId || null,
//   );

//   if (!customerId) {
//     return (
//       <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
//         <div className="rounded-2xl font-display bg-[#fafafa] p-4 text-sm text-neutral-400">
//           Missing customerId in URL. Open a customer from the customers list.
//         </div>
//       </div>
//     );
//   }

//   if (isLoading) {
//     return (
//       <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
//         <div className="rounded-2xl font-display p-4 text-sm text-neutral-400">
//           <LoadingSpinner />
//         </div>
//       </div>
//     );
//   }

//   if (!customer) {
//     return (
//       <div className="max-w-screen-lg mx-auto px-3 sm:px-0">
//         <div className="rounded-2xl font-display bg-[#fafafa] p-4 text-sm text-neutral-400">
//           Customer not found.
//         </div>
//       </div>
//     );
//   }

//   const metrics: Metric[] = [
//     {
//       label: "First Sale date",
//       value: formatDate(customer.firstSaleAt, fullDateFormatter),
//     },
//     {
//       label: "Time to sale",
//       value: getTimeToSale(customer.createdAt, customer.firstSaleAt),
//     },
//     { label: "Lifetime Value", value: formatAmount(customer.saleAmount ?? 0) },
//     {
//       label: "Subscription Cancelled",
//       value: formatDate(customer.subscriptionCanceledAt, fullDateFormatter),
//     },
//   ];

//   return (
//     <div className="max-w-screen-lg mx-auto px-3 sm:px-0 space-y-6">
//       <CustomerMetrics metrics={metrics} />

//       <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
//         <div className="order-2 lg:col-span-2 lg:order-1">
//           <ActivitySection
//             activity={activity}
//             isLoading={activityLoading}
//             timeFormatter={shortTimeFormatter}
//           />
//         </div>

//         <div className="order-1 lg:order-2">
//           <CustomerInfoCard customer={customer} />
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useCustomer from "@/lib/swr/use-customer";
import useCustomerActivity from "@/lib/swr/use-customer-activity";
import useWorkspace from "@/lib/swr/use-workspace";
import { LoadingSpinner } from "@repo/ui";
import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatAmount,
  getTimeToSale,
} from "@/lib/customers/format";
import { ActivitySection } from "@/ui/customers/activity-section";
import { CustomerMetrics, type Metric } from "@/ui/customers/customer-metrics";
import { CustomerInfoCard } from "@/ui/customers/customer-info-card";

export default function CustomerDetailsPage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const { customer, loading: isLoading } = useCustomer(customerId);
  const { id: workspaceId, timezone } = useWorkspace();
  const tz = timezone || DEFAULT_TIMEZONE;

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const update = () => setCardHeight(el.offsetHeight);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [customer]);

  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: tz,
      }),
    [tz],
  );

  const shortTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      }),
    [tz],
  );

  const { activity, isLoading: activityLoading } = useCustomerActivity(
    customerId,
    workspaceId || null,
  );

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
        <div className="rounded-2xl font-display p-4 text-sm text-neutral-400">
          <LoadingSpinner />
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

  const metrics: Metric[] = [
    {
      label: "First Sale date",
      value: formatDate(customer.firstSaleAt, fullDateFormatter),
    },
    {
      label: "Time to sale",
      value: getTimeToSale(customer.createdAt, customer.firstSaleAt),
    },
    { label: "Lifetime Value", value: formatAmount(customer.saleAmount ?? 0) },
    {
      label: "Subscription Cancelled",
      value: formatDate(customer.subscriptionCanceledAt, fullDateFormatter),
    },
  ];

  return (
    <div className="max-w-screen-lg mx-auto px-3 sm:px-0 space-y-6">
      <CustomerMetrics metrics={metrics} />

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
        <div className="order-2 lg:col-span-2 lg:order-1">
          <ActivitySection
            activity={activity}
            isLoading={activityLoading}
            timeFormatter={shortTimeFormatter}
            maxHeight={cardHeight}
          />
        </div>

        <div ref={cardRef} className="order-1 lg:order-2">
          <CustomerInfoCard customer={customer} />
        </div>
      </div>
    </div>
  );
}