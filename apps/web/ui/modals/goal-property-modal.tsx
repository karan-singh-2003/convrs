"use client";

import { useContext, useMemo, useEffect, useRef, useCallback, useState } from "react";
import { Modal } from "@repo/ui";
import { LoadingSpinner } from "@repo/ui";
import { nFormatter } from "@repo/utils";
import { AnalyticsContext } from "../analytics/analytics-providers";
import { useAnalyticsFilterOption } from "../analytics/use-analytics-filter-option";

// ── Inner modal content ────────────────────────────────────────────────────────

function GoalPropertiesModalInner({
  goalName,
  showModal,
  setShowModal,
}: {
  goalName: string;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const context = useContext(AnalyticsContext);

  const { data, loading } = useAnalyticsFilterOption(
    { groupBy: "goal_properties" as any, goalName },
    { context }
  );

  const grouped = useMemo(() => {
    if (!data) return null;
    const map: Record<string, { value: string; count: number }[]> = {};
    for (const item of data) {
      const raw      = (item as any).goal_property ?? "";
      const splitIdx = raw.indexOf("::");
      const propKey  = (item as any).prop_key ?? (splitIdx === -1 ? raw : raw.slice(0, splitIdx));
      const val      = splitIdx === -1 ? "" : raw.slice(splitIdx + 2);
      if (!map[propKey]) map[propKey] = [];
      map[propKey].push({ value: val, count: item.clicks ?? 0 });
    }
    return map;
  }, [data]);

  const hasProperties = grouped && Object.keys(grouped).length > 0;

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="max-h-[85vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-neutral-100 px-5 py-4">
        <p className="text-[11px] font-medium uppercase font-display tracking-widest text-neutral-400">
          Goal Properties
        </p>
        <h3 className="mt-0.5 truncate font-display text-[16px] font-semibold text-neutral-500 md:text-[17px]">
          {goalName}
        </h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-44 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : !hasProperties ? (
          <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-neutral-400">
              No properties recorded for this goal.
            </p>
            <p className="text-xs text-neutral-300">
              Pass props when calling{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">
                trackEvent
              </code>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped!).map(([propKey, values]) => (
              <PropertyGroup key={propKey} propKey={propKey} values={values} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Property group bar list ────────────────────────────────────────────────────

function PropertyGroup({
  propKey,
  values,
}: {
  propKey: string;
  values: { value: string; count: number }[];
}) {
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div>
      {/* <p className="mb-2 text-[11px] font-display font-medium uppercase tracking-widest text-neutral-500">
        {propKey}
      </p> */}
      <div className="space-y-0">
        {values.map(({ value, count }) => (
          <div key={value} className="group relative flex items-center">
            {/* Bar */}
            <div className="absolute inset-0 overflow-hidden rounded-none pointer-events-none">
              <div
                className="h-full bg-neutral-100 transition-all duration-300"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            {/* Label */}
            <span className="relative z-10 flex-1 font-display font-medium truncate px-3 py-1.5  text-[13.5px] text-neutral-7600">
              {value || (
                <span className="italic font-display font-medium text-neutral-300">(empty)</span>
              )}
            </span>
            {/* Count */}
            <span className="relative z-10 pr-3 font-display text-[13px] font-semibold tabular-nums text-neutral-500">
              {nFormatter(count, { full: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGoalPropertiesModal() {
  const [showModal, setShowModal]   = useState(false);
  const [goalName,  setGoalName]    = useState<string>("");

  const openModal = useCallback((name: string) => {
    setGoalName(name);
    setShowModal(true);
  }, []);

  const GoalPropertiesModal = useCallback(() => {
    if (!goalName) return null;
    return (
      <GoalPropertiesModalInner
        goalName={goalName}
        showModal={showModal}
        setShowModal={setShowModal}
      />
    );
  }, [goalName, showModal]);

  return useMemo(
    () => ({ openGoalPropertiesModal: openModal, GoalPropertiesModal }),
    [openModal, GoalPropertiesModal]
  );
}