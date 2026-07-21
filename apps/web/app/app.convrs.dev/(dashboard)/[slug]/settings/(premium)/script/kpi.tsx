"use client";

import { Combobox, Label, RadioGroup, RadioGroupItem, ToggleGroup } from "@repo/ui";
import { fetcher } from "@repo/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";
import { useAddGoalModal } from "@/ui/modals/add-goal-modal";

type TrackedEvent = {
    eventName: string;
    eventType: string;
    trigger: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
};

type KpiResponse = {
    data: {
        kpiType: "revenue" | "goal";
        kpiEventName: string | null;
    };
};

type EventOption = {
    value: string;
    label: string;
};

function humanizeEventName(name: string) {
    // "checkout_completed" -> "Checkout Completed"
    return name
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function KPI() {
    const { id: workspaceId, slug: workspaceSlug } = useWorkspace();
    const { mutate: globalMutate } = useSWRConfig();
    const { setShowAddGoalModal, AddGoalModal } = useAddGoalModal();

    const workspaceIdOrSlug = workspaceSlug ?? workspaceId;

    // ── Fetch real tracked goal events for the dropdown ──────────────────────
    const {
        data: trackedEventsRes,
        isLoading: eventsLoading,
    } = useSWR<{ data: TrackedEvent[] }>(
        workspaceIdOrSlug
            ? `/api/workspaces/${workspaceIdOrSlug}/tracked-events?eventType=goals`
            : null,
        fetcher
    );

    const eventOptions = useMemo(
        () =>
            (trackedEventsRes?.data ?? []).map((event) => ({
                value: event.eventName,
                label: humanizeEventName(event.eventName),
            })),
        [trackedEventsRes]
    );

    // ── Fetch the workspace's current KPI setting ─────────────────────────────
    const {
        data: kpiRes,
        isLoading: kpiLoading,
    } = useSWR<KpiResponse>(
        workspaceIdOrSlug ? `/api/workspaces/${workspaceIdOrSlug}/kpi` : null,
        fetcher
    );

    const [kpi, setKpi] = useState<"Revenue" | "Goal">("Revenue");
    const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
    const [saving, setSaving] = useState(false);

    // ── Sync local state once the workspace's saved KPI loads ────────────────
    useEffect(() => {
        if (!kpiRes?.data) return;

        setKpi(kpiRes.data.kpiType === "goal" ? "Goal" : "Revenue");

        if (kpiRes.data.kpiType === "goal" && kpiRes.data.kpiEventName) {
            const savedName = kpiRes.data.kpiEventName;
            const matched = eventOptions.find((o) => o.value === savedName);
            setSelectedEvent(
                matched ?? {
                    value: savedName,
                    label: humanizeEventName(savedName),
                }
            );
        }
    }, [kpiRes, eventOptions]);

    // Default the dropdown to the first real event once options load,
    // if nothing is selected yet (e.g. workspace has no KPI set at all)
    useEffect(() => {
        if (!selectedEvent && eventOptions.length > 0 && kpi === "Goal") {
            setSelectedEvent(eventOptions[0]);
        }
    }, [eventOptions, kpi, selectedEvent]);

    const onChange = (option: (typeof eventOptions)[number] | null) => {
        if (!option) return;
        setSelectedEvent(option);
    };

    const hasUnsavedChange =
        kpiRes?.data &&
        (kpi === "Goal"
            ? kpiRes.data.kpiType !== "goal" ||
            kpiRes.data.kpiEventName !== selectedEvent?.value
            : kpiRes.data.kpiType !== "revenue");

    const canSave =
        kpi === "Revenue" || (kpi === "Goal" && !!selectedEvent?.value);

    const handleSave = async () => {
        if (!workspaceIdOrSlug || !canSave) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/workspaces/${workspaceIdOrSlug}/kpi`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    kpi === "Revenue"
                        ? { kpiType: "revenue" }
                        : { kpiType: "goal", kpiEventName: selectedEvent?.value }
                ),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error ?? "Failed to update KPI");
            }

            toast.success(
                kpi === "Revenue"
                    ? "KPI set to Revenue"
                    : `KPI set to "${selectedEvent?.label}"`
            );

            // Revalidate both this widget's cache and anywhere else workspace.kpiType
            // is read from (e.g. useWorkspace()) so tabs/charts update immediately
            await globalMutate(`/api/workspaces/${workspaceIdOrSlug}/kpi`);
            await globalMutate(
                (key) => typeof key === "string" && key.startsWith("/api/workspaces"),
                undefined,
                { revalidate: true }
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <AddGoalModal />
            <div className="bg-bg-default border border-border-subtle rounded-xl p-4">
                <div className="space-y-3">
                    <div className="space-y-0.5">
                        <h2 className="font-display text-sm font-medium text-neutral-600">
                            KPI
                        </h2>
                        <p className="font-display text-[14px] text-neutral-500">
                            What's the most important metric for this workspace?
                        </p>
                    </div>

                    {kpiLoading ? (
                        <div className="h-10 animate-pulse rounded-lg bg-bg-card" />
                    ) : (
                        <>
                            <ToggleGroup
                                options={[
                                    { value: "Revenue", label: "Revenue" },
                                    { value: "Goal", label: "Goal" },
                                ]}
                                selected={kpi}
                                selectAction={(option) => setKpi(option as "Revenue" | "Goal")}
                                className="w-full border border-border-subtle bg-bg-emphasis"
                                optionClassName="w-full justify-center px-3 py-1 text-sm"
                            />

                            {kpi === "Revenue" && (
                                <RadioGroup value="revenue">
                                    <div className="flex items-center rounded-2xl bg-bg-emphasis/65 px-4 py-3 gap-4">
                                        <RadioGroupItem value="revenue" id="option-revenue" />
                                        <div>
                                            <Label
                                                htmlFor="option-revenue"
                                                className="font-display font-medium text-content-default"
                                            >
                                                Revenue
                                            </Label>
                                            <h1 className="font-display text-[13.5px] font-medium text-content-subtle">
                                                Shows how your revenue changes over time
                                            </h1>
                                        </div>
                                    </div>
                                
                                </RadioGroup>
                            )}

                            {kpi === "Goal" && (
                                <>
                                    {eventsLoading ? (
                                        <div className="h-10 animate-pulse rounded-xl bg-bg-emphasis" />
                                    ) : eventOptions.length === 0 ? (
                                        <div className="space-y-3 rounded-xl border  border-border-subtle bg-bg-subtle p-4 font-display">
                                            <p className="text-[13px] leading-5 text-content-subtle">
                                                No goal events have been tracked yet. Once a custom event is received
                                                from your site, it'll appear here so you can use it as a KPI.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => setShowAddGoalModal(true)}
                                                className="rounded-lg bg-bg-default px-4 py-2 text-[13px] font-medium text-content-default transition-colors hover:bg-bg-emphasis"
                                            >
                                                Add Goal
                                            </button>
                                        </div>
                                    ) : (
                                        <Combobox
                                            selected={selectedEvent}
                                            setSelected={onChange}
                                            options={eventOptions}
                                            searchPlaceholder="Search events..."
                                            placeholder="Select an event"
                                            trigger={
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-bg-subtle px-4 py-2.5 font-display text-[14px] text-content-default transition-colors hover:bg-bg-emphasis"
                                                >
                                                    <span
                                                        className={
                                                            selectedEvent
                                                                ? "truncate text-content-default"
                                                                : "truncate text-content-subtle"
                                                        }
                                                    >
                                                        {selectedEvent?.label ?? "Select an event"}
                                                    </span>

                                                    <ChevronDown className="h-4 w-4 shrink-0 text-content-subtle" />
                                                </button>
                                            }
                                        />
                                    )}
                                </>
                            )}

                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!canSave || saving || !hasUnsavedChange}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 font-display text-[14px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {saving ? "Saving..." : "Save KPI"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}