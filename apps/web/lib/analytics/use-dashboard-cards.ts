"use client";

import { useCallback, useEffect, useState } from "react";

export type DashboardCardSettings = {
  botFiltering: boolean;
};

const DEFAULT_DASHBOARD_CARD_SETTINGS: DashboardCardSettings = {
  botFiltering: true,
};

function storageKey(workspaceId: string) {
  return `convrs:dashboard-cards:${workspaceId}`;
}

export function useDashboardCards(workspaceId?: string) {
  const [settings, setSettings] = useState<DashboardCardSettings>(
    DEFAULT_DASHBOARD_CARD_SETTINGS
  );

  useEffect(() => {
    if (!workspaceId) return;

    try {
      const raw = localStorage.getItem(storageKey(workspaceId));
      setSettings(
        raw
          ? { ...DEFAULT_DASHBOARD_CARD_SETTINGS, ...JSON.parse(raw) }
          : DEFAULT_DASHBOARD_CARD_SETTINGS
      );
    } catch {
      setSettings(DEFAULT_DASHBOARD_CARD_SETTINGS);
    }
  }, [workspaceId]);

  const updateSettings = useCallback(
    (patch: Partial<DashboardCardSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };

        if (workspaceId) {
          try {
            localStorage.setItem(storageKey(workspaceId), JSON.stringify(next));
          } catch {
            // localStorage can throw in private browsing / storage-full contexts; the
            // toggle still works for the rest of this session via component state.
          }
        }

        return next;
      });
    },
    [workspaceId]
  );

  return { settings, updateSettings };
}
