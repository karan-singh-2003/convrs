"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SecurityFilterCard } from "./security-filter-card";

type TrackingFilterCard = {
  key: TrackingFilterKey;
  title: string;
  description: string;
  placeholder: string;
  actionLabel: string;
  helperText: string;
  emptyText: string;
  defaultItems?: string[];
  allowInfoIcon?: boolean;
};

type TrackingFilterKey =
  | "blockedHostnames"
  | "blockedIpAddresses"
  | "blockedPages";

type ScriptConfigPayload = {
  domain: string | null;
  projectToken: string | null;
  blockedHostnames: string[];
  blockedIpAddresses: string[];
  blockedPages: string[];
};

const defaultFilters: Pick<
  ScriptConfigPayload,
  "blockedHostnames" | "blockedIpAddresses" | "blockedPages"
> = {
  blockedHostnames: [],
  blockedIpAddresses: [],
  blockedPages: [],
};

const cards: TrackingFilterCard[] = [
  {
    key: "blockedHostnames",
    title: "Blocked hostnames",
    description: "Specify the hostnames that are blocked from tracking events.",
    placeholder: "*.example.com",
    actionLabel: "Block",
    helperText: "Use wildcards like *.example.com",
    emptyText: "You haven't added any hostnames yet.",
    allowInfoIcon: true,
  },
  {
    key: "blockedIpAddresses",
    title: "Blocked IP addresses",
    description: "Block specific IP addresses from tracking events.",
    placeholder: "192.168.1.1 or 10.0.0.0/24",
    actionLabel: "Block",
    helperText: "Tip: Block your own IP address",
    emptyText: "You haven't blocked any IPs yet.",
  },
  {
    key: "blockedPages",
    title: "Blocked pages",
    description: "Block specific pages from being tracked.",
    placeholder: "/admin or /dashboard/*",
    actionLabel: "Block",
    helperText: "Use wildcards like /admin/*",
    emptyText: "You haven't blocked any pages yet.",
  },
];

export function TrackingFilters() {
  const { slug } = useParams() as { slug?: string };
  const [filters, setFilters] = useState(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<
    Record<TrackingFilterKey, boolean>
  >({
    blockedHostnames: false,
    blockedIpAddresses: false,
    blockedPages: false,
  });

  useEffect(() => {
    if (!slug) {
      return;
    }

    setIsLoading(true);

    fetch(`/api/workspaces/${slug}/script-config`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch tracking filters");
        }

        const data = (await res.json()) as ScriptConfigPayload;
        setFilters({
          blockedHostnames: data.blockedHostnames || [],
          blockedIpAddresses: data.blockedIpAddresses || [],
          blockedPages: data.blockedPages || [],
        });
      })
      .catch(() => {
        toast.error("Unable to load tracking filters");
        setFilters(defaultFilters);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  const persistFilters = async (nextFilters: typeof defaultFilters) => {
    if (!slug) {
      throw new Error("Workspace slug is missing");
    }

    const res = await fetch(`/api/workspaces/${slug}/script-config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextFilters),
    });

    if (!res.ok) {
      throw new Error("Failed to update tracking filters");
    }

    const data = (await res.json()) as ScriptConfigPayload;

    setFilters({
      blockedHostnames: data.blockedHostnames || [],
      blockedIpAddresses: data.blockedIpAddresses || [],
      blockedPages: data.blockedPages || [],
    });
  };

  const updateFilterItems = async (
    key: TrackingFilterKey,
    computeNextItems: (items: string[]) => string[]
  ) => {
    const previous = filters;
    const nextItems = computeNextItems(previous[key]);

    if (nextItems.join("|") === previous[key].join("|")) {
      return;
    }

    const next = {
      ...previous,
      [key]: nextItems,
    };

    setFilters(next);
    setSavingState((current) => ({
      ...current,
      [key]: true,
    }));

    try {
      await persistFilters(next);
    } catch {
      setFilters(previous);
      toast.error("Unable to save tracking filters");
    } finally {
      setSavingState((current) => ({
        ...current,
        [key]: false,
      }));
    }
  };

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
          items={filters[card.key]}
          loading={isLoading}
          saving={savingState[card.key]}
          onAdd={(value) =>
            updateFilterItems(card.key, (items) => {
              const exists = items.some(
                (item) => item.toLowerCase() === value.toLowerCase()
              );

              if (exists) {
                return items;
              }

              return [...items, value];
            })
          }
          onRemove={(value) =>
            updateFilterItems(card.key, (items) =>
              items.filter((item) => item !== value)
            )
          }
          allowInfoIcon={card.allowInfoIcon}
        />
      ))}
    </div>
  );
}
