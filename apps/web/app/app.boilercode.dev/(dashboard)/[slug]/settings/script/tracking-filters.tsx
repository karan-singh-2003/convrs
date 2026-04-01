"use client";

import { SecurityFilterCard } from "./security-filter-card";

type TrackingFilterCard = {
  title: string;
  description: string;
  placeholder: string;
  actionLabel: string;
  helperText: string;
  emptyText: string;
  defaultItems?: string[];
  allowInfoIcon?: boolean;
};

const cards: TrackingFilterCard[] = [
  {
    title: "Blocked hostnames",
    description: "Specify the hostnames that are blocked from tracking events.",
    placeholder: "*.example.com",
    actionLabel: "Block",
    helperText: "Use wildcards like *.example.com",
    emptyText: "You haven't added any hostnames yet.",
    defaultItems: ["boilercode.dev"],
    allowInfoIcon: true,
  },
  {
    title: "Blocked IP addresses",
    description: "Block specific IP addresses from tracking events.",
    placeholder: "192.168.1.1 or 10.0.0.0/24",
    actionLabel: "Block",
    helperText: "Tip: Block your own IP address",
    emptyText: "You haven't blocked any IPs yet.",
  },
  {
    title: "Blocked pages",
    description: "Block specific pages from being tracked.",
    placeholder: "/admin or /dashboard/*",
    actionLabel: "Block",
    helperText: "Use wildcards like /admin/*",
    emptyText: "You haven't blocked any pages yet.",
  },
];

export function TrackingFilters() {
  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <SecurityFilterCard
          key={card.title}
          title={card.title}
          description={card.description}
          placeholder={card.placeholder}
          actionLabel={card.actionLabel}
          helperText={card.helperText}
          emptyText={card.emptyText}
          defaultItems={card.defaultItems ? [...card.defaultItems] : undefined}
          allowInfoIcon={card.allowInfoIcon}
        />
      ))}
    </div>
  );
}
