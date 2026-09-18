"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useWorkspace from "./use-workspace";
import useIntegrations from "./use-integration";
import { useAttributionStatus } from "./use-attribution";

export type SetupStep = {
  title: string;
  description?: string;
  action?: ReactNode;
  completed: boolean;
};

/**
 * Single source of truth for the "Finish setting up Convrs" checklist.
 *
 * Originally computed inline in `[slug]/(overview)/page.tsx` (whose UI is now
 * a circular progress indicator + popover in `ui/layout/sidebar/main-nav.tsx`
 * — see `ui/layout/sidebar/setup-progress.tsx`). Extracted here so both the
 * old page and the new sidebar UI read the exact same steps/completion state
 * instead of maintaining two copies.
 *
 * Returns `steps: []` when there's no workspace in scope (e.g. routes with no
 * `[slug]`, or before the workspace has loaded) — callers should treat an
 * empty array as "nothing to show" rather than rendering "0/0".
 */
export function useSetupProgress() {
  const { slug } = useParams<{ slug?: string }>();
  const { usage, id } = useWorkspace();
  const { integrations } = useIntegrations();
  const { hasAttributedPayment } = useAttributionStatus(id);

  const steps = useMemo<SetupStep[]>(() => {
    if (!id) return [];

    return [
      { title: "Install script", completed: !!usage },
      {
        title: "Connect revenue",
        description: "See your sales and revenue directly in Convrs.",
        action: (
          <Link href={`/${slug}/settings/revenue`}>Connect payment provider</Link>
        ),
        completed: integrations.length > 0,
      },
      {
        title: "Attribute payments",
        description:
          "A customer payment has been successfully attributed to a visitor session.",
        completed: hasAttributedPayment, // ← reads from Postgres, not Tinybird
      },
    ];
  }, [id, usage, integrations, hasAttributedPayment, slug]);

  const completedSteps = steps.filter((s) => s.completed).length;

  return { steps, completedSteps };
}
