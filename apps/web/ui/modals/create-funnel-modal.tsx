"use client";

import { Modal } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crosshair } from "lucide-react";
import { cn } from "@repo/utils";
import { Input, Button,  ToggleGroup } from "@repo/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepType = "goal" | "page_view";

type FunnelStep = {
  id: string;
  name: string;
  value: string;
  type: StepType;
};

const TYPE_META: Record<StepType, { label: string; actionLabel: string }> = {
  goal:      { label: "Goal",      actionLabel: "completes" },
  page_view: { label: "Page view", actionLabel: "visits"    },
};

const SUGGESTED_FUNNELS = ["Onboarding", "Signup flow", "Purchase"];
const MAX_STEPS = 8;

// ─── Sortable step ────────────────────────────────────────────────────────────

function SortableStep({
  step,
  index,
  onRemove,
}: {
  step: FunnelStep;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-2xl  bg-white px-4 py-3",
        isDragging && "opacity-40"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-neutral-300 hover:text-neutral-400 active:cursor-grabbing"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="3" cy="3"  r="1.2" />
          <circle cx="3" cy="7"  r="1.2" />
          <circle cx="3" cy="11" r="1.2" />
          <circle cx="8" cy="3"  r="1.2" />
          <circle cx="8" cy="7"  r="1.2" />
          <circle cx="8" cy="11" r="1.2" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[14px] font-medium text-neutral-700">
          {index + 1}.&nbsp;&nbsp;{step.name}
        </p>
        <p className="font-display mt-0.5 text-[13px] text-neutral-400">
          {TYPE_META[step.type].label} : {step.value}
        </p>
      </div>

      <button
        onClick={() => onRemove(step.id)}
        className="shrink-0 text-lg leading-none text-neutral-300 transition-colors hover:text-neutral-500"
      >
        ×
      </button>
    </div>
  );
}

// ─── Modal inner ──────────────────────────────────────────────────────────────

function CreateFunnelModal({
  showModal,
  setShowModal,
}: {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();

  const [funnelName, setFunnelName] = useState("");
  const [stepName,   setStepName]   = useState("");
  const [stepValue,  setStepValue]  = useState("");
  const [stepType,   setStepType]   = useState<StepType>("goal");
  const [steps,      setSteps]      = useState<FunnelStep[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    if (!stepName.trim() && !stepValue.trim()) return;
    setSteps((prev) => [
      ...prev,
      {
        id:    crypto.randomUUID(),
        name:  stepName.trim()  || "Untitled step",
        value: stepValue.trim() || "—",
        type:  stepType,
      },
    ]);
    setStepName("");
    setStepValue("");
  };

  const removeStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((prev) => {
        const oldIdx = prev.findIndex((s) => s.id === active.id);
        const newIdx = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleCreate = async () => {
    if (!funnelName.trim() || steps.length === 0) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/funnels", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: funnelName, steps }),
      });
      if (!res.ok) throw new Error();
      toast.success("Funnel created!");
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to create funnel.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="flex h-[85dvh] flex-col overflow-hidden p-0 md:max-w-[900px]"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-100 px-5 py-4">
        <h3 className="font-display text-[15px] font-medium text-black/70">
          Create funnel
        </h3>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">

        {/* ── Left panel ── */}
        <div className="flex h-full flex-col overflow-hidden border-b border-neutral-100 md:border-b-0 md:border-r">

          {/* Scrollable form area */}
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">

            {/* Funnel name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-display text-[13.5px] font-medium text-neutral-500">
                Funnel name
              </label>
              <Input
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
                placeholder="e.g. Onboarding"
              />
            </div>

            {/* Step builder */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="font-display text-[13.5px] font-medium text-neutral-500">
                  Step
                  <span className="ml-1 font-normal text-neutral-400">
                    : {TYPE_META[stepType].label}
                  </span>
                </label>

                <ToggleGroup
                  options={[
                    {
                      value: "page_view",
                      label: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-3.5 w-3.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 20.247 6-16.5" />
                        </svg>
                      ),
                    },
                    {
                      value: "goal",
                      label: <Crosshair size={14} />,
                    },
                  ]}
                  selected={stepType}
                  selectAction={(val) => setStepType(val as StepType)}
                  optionClassName="px-3 py-1.5 flex items-center justify-center"
                  className="w-fit"
                />
              </div>

              <Input
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                placeholder="Step name"
              />

              <div className="flex gap-2">
                <div className="flex h-10 shrink-0 items-center border border-neutral-200 bg-neutral-50 px-3 font-display text-[13.5px] font-medium text-neutral-500">
                  {TYPE_META[stepType].actionLabel}
                </div>
                <Input
                  value={stepValue}
                  onChange={(e) => setStepValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStep()}
                  placeholder="e.g. signup"
                />
              </div>

              <Button
                variant="primary"
                text="Add step"
                onClick={addStep}
                disabled={steps.length >= MAX_STEPS}
              />
            </div>
          </div>

          {/* Suggested — pinned to bottom of left panel */}
          <div className="shrink-0  px-5 py-4">
            <p className="font-display mb-2 text-[12px] text-neutral-400">
              Suggested
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_FUNNELS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFunnelName(s)}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-display text-[12.5px] font-medium text-neutral-500 hover:bg-neutral-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex h-full flex-col gap-3 overflow-hidden p-4">

          {/* Step count header */}
          <div className="shrink-0 flex items-center justify-between">
            <p className="font-display text-[13px] font-medium text-neutral-500">
              {steps.length}/{MAX_STEPS} steps
            </p>
            {steps.length > 1 && (
              <p className="font-display text-[11px] text-neutral-400">
                drag to reorder
              </p>
            )}
          </div>

          {/* Steps list or empty state */}
          {steps.length === 0 ? (
            <div className="flex flex-1 items-center  justify-center rounded-2xl bg-[#F8F8F8]">
              <p className="font-display text-[13px] text-neutral-400">
                No steps yet
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto rounded-2xl bg-[#F8F8F8] p-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {steps.map((step, i) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        index={i}
                        onRemove={removeStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex justify-end gap-2 border-t border-neutral-100 px-5 py-3">
        <Button
          text="Cancel"
          variant="outline"
          onClick={() => setShowModal(false)}
          className="w-fit rounded-full"
        />
        <Button
          text={isLoading ? "Creating…" : "Create funnel"}
          onClick={handleCreate}
          disabled={isLoading || !funnelName.trim() || steps.length === 0}
          className="w-fit rounded-full"
        />
      </div>
    </Modal>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCreateFunnelModal() {
  const [showModal, setShowModal] = useState(false);

  const CreateFunnelModalCallback = useCallback(
    () => (
      <CreateFunnelModal showModal={showModal} setShowModal={setShowModal} />
    ),
    [showModal]
  );

  return useMemo(
    () => ({
      setShowCreateFunnelModal: setShowModal,
      CreateFunnelModal: CreateFunnelModalCallback,
    }),
    [setShowModal, CreateFunnelModalCallback]
  );
}