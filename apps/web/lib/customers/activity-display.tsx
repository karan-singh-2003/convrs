import { LogIn } from "lucide-react";
import { type ActivityEvent } from "@/lib/swr/use-customer-activity";
import { formatRevenue } from "./format";

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

function PageviewIcon() {
  return (
    <div className="size-5 -ml-0.5 flex items-center justify-center rounded-full bg-bg-card">
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
    </div>
  );
}

function GoalIcon() {
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
}

function DefaultIcon() {
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

export function eventIcon(ev: ActivityEvent) {
  if (ev.event_type === "revenue") return <RevenueIcon />;
  if (ev.event_type === "pageview") return <PageviewIcon />;
  if (ev.event_name === "identify") return <LogIn size={16} />;
  if (ev.event_type === "goals") return <GoalIcon />;
  return <DefaultIcon />;
}

export function eventTitle(ev: ActivityEvent) {
  if (ev.event_type === "revenue") {
    const formatted = formatRevenue(ev.revenue, ev.currency);
    return formatted ? `Paid ${formatted}` : ev.event_name.replace(/_/g, " ");
  }
  if (ev.event_type === "pageview") return `Visited ${ev.page ?? ev.url ?? "a page"}`;
  if (ev.event_name === "identify") return "Identified as user";
  return ev.event_name.replace(/_/g, " ");
}