"use client";

import { Modal, Input, Button, ToggleGroup } from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
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
import useFunnels from "@/lib/swr/use-funnels";
import { FunnelProps } from "@/lib/types";

type StepType = "goal" | "page_view";

type FunnelStep = {
  id: string;
  name: string;
  value: string;
  type: StepType;
};

const TYPE_META: Record<StepType, { label: string; actionLabel: string }> = {
  goal: { label: "Goal", actionLabel: "completes" },
  page_view: { label: "Page view", actionLabel: "visits" },
};

const SUGGESTED_FUNNELS = ["Onboarding", "Signup flow", "Purchase"];
const MAX_STEPS = 8;

function SortableStep({
  step,
  index,
  onRemove,
}: {
  step: FunnelStep;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-white px-4 py-3",
        isDragging && "opacity-40"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-neutral-300 hover:text-neutral-400 active:cursor-grabbing"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="3" cy="3" r="1.2" />
          <circle cx="3" cy="7" r="1.2" />
          <circle cx="3" cy="11" r="1.2" />
          <circle cx="8" cy="3" r="1.2" />
          <circle cx="8" cy="7" r="1.2" />
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

function CreateFunnelEditorModal({
  showModal,
  setShowModal,
  editingFunnel,
}: {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  editingFunnel: FunnelProps | null;
}) {
  const params = useParams() as { slug?: string };
  const { mutate } = useFunnels({
    swrOpts: { revalidateOnFocus: false },
  });

  const [funnelName, setFunnelName] = useState("");
  const [stepName, setStepName] = useState("");
  const [stepValue, setStepValue] = useState("");
  const [stepType, setStepType] = useState<StepType>("goal");
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const resetEditor = useCallback(() => {
    setFunnelName("");
    setStepName("");
    setStepValue("");
    setStepType("goal");
    setSteps([]);
  }, []);

  useEffect(() => {
    if (!showModal) return;

    if (!editingFunnel) {
      resetEditor();
      return;
    }

    setFunnelName(editingFunnel.name);
    setStepName("");
    setStepValue("");
    setStepType("goal");
    setSteps(
      editingFunnel.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          id: step.id,
          name: step.name,
          value: step.value,
          type: step.type,
        }))
    );
  }, [editingFunnel, resetEditor, showModal]);

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    if (!stepName.trim() && !stepValue.trim()) return;

    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: stepName.trim() || "Untitled step",
        value: stepValue.trim() || "-",
        type: stepType,
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

  const handleSave = async () => {
    if (!funnelName.trim() || steps.length === 0) return;
    if (!params.slug) {
      toast.error("Workspace not found.");
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = editingFunnel
        ? `/api/workspaces/${params.slug}/funnels/${editingFunnel.id}`
        : `/api/workspaces/${params.slug}/funnels`;
      const method = editingFunnel ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: funnelName,
          steps: steps.map((step, index) => ({
            name: step.name,
            value: step.value,
            type: step.type,
            order: index,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to create funnel");
      }

      toast.success(editingFunnel ? "Funnel updated!" : "Funnel created!");
      await mutate();
      setShowModal(false);
      resetEditor();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create funnel."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="flex h-[85dvh] max-w-[900px] flex-col overflow-hidden p-0"
    >
      <div className="shrink-0 border-b border-neutral-100 px-5 py-4">
        <h3 className="font-display text-[15px] font-medium text-black/70">
          {editingFunnel ? "Edit funnel" : "Create funnel"}
        </h3>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="flex h-full flex-col overflow-hidden border-b border-neutral-100 md:border-b-0 md:border-r">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m9 20.247 6-16.5"
                          />
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
                  optionClassName="flex items-center justify-center px-3 py-1.5"
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

          <div className="shrink-0 px-5 py-4">
            <p className="font-display mb-2 text-[12px] text-neutral-400">
              Suggested
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_FUNNELS.map((suggested) => (
                <button
                  key={suggested}
                  onClick={() => setFunnelName(suggested)}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-display text-[12.5px] font-medium text-neutral-500 hover:bg-neutral-50"
                >
                  {suggested}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
          <div className="flex shrink-0 items-center justify-between">
            <p className="font-display text-[13px] font-medium text-neutral-500">
              {steps.length}/{MAX_STEPS} steps
            </p>
            {steps.length > 1 && (
              <p className="font-display text-[11px] text-neutral-400">
                drag to reorder
              </p>
            )}
          </div>

          {steps.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl bg-[#F8F8F8]">
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
                    {steps.map((step, index) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        index={index}
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

      <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-5 py-3">
        <Button
          text="Cancel"
          variant="outline"
          onClick={() => {
            setShowModal(false);
            resetEditor();
          }}
          className="w-fit rounded-full"
        />
        <Button
          text={
            isLoading
              ? "Saving..."
              : editingFunnel
                ? "Save changes"
                : "Create funnel"
          }
          onClick={handleSave}
          disabled={isLoading || !funnelName.trim() || steps.length === 0}
          className="w-fit rounded-full"
        />
      </div>
    </Modal>
  );
}

function FunnelListModal({
  showModal,
  setShowModal,
  onCreate,
  onEdit,
  onSelectFunnel,
}: {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onCreate: () => void;
  onEdit: (funnel: FunnelProps) => void;
  onSelectFunnel?: (funnel: FunnelProps) => void;
}) {
  const params = useParams() as { slug?: string };
  const { funnels, mutate } = useFunnels({
    swrOpts: { revalidateOnFocus: false },
  });

  const handleDelete = useCallback(
    async (funnelId: string) => {
      if (!params.slug) {
        toast.error("Workspace not found.");
        return;
      }

      try {
        const res = await fetch(
          `/api/workspaces/${params.slug}/funnels/${funnelId}`,
          {
            method: "DELETE",
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to delete funnel");
        }

        toast.success("Funnel deleted");
        await mutate();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete funnel."
        );
      }
    },
    [mutate, params.slug]
  );

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="flex flex-col overflow-hidden p-0"
    >
      <div className="shrink-0 border-b border-neutral-100 px-5 py-4">
        <h3 className="font-display text-[16px] font-semibold text-neutral-600">
          Funnels
        </h3>
      </div>

      <div className="p-5">
        <div className="divide-y divide-neutral-200 rounded-3xl bg-neutral-50">
          {funnels.length > 0 ? (
            funnels.map((funnel) => (
              <div
                key={funnel.id}
                className="flex w-full items-center justify-between gap-3 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectFunnel?.(funnel);
                    setShowModal(false);
                  }}
                  className="min-w-0 flex-1 text-left transition"
                >
                  <p className="font-display truncate text-sm font-medium text-neutral-600">
                    {funnel.name}
                  </p>
                  <p className="font-display text-sm text-neutral-400">
                    {funnel.steps.length} steps
                  </p>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(funnel)}
                    className="font-display rounded-full p-2 text-[12.5px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label={`Edit ${funnel.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(funnel.id)}
                    className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
                    aria-label={`Delete ${funnel.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-white px-4 py-6 text-center font-display text-sm text-neutral-500">
              No funnels yet
            </div>
          )}
        </div>

        <Button
          text="Add Funnel"
          onClick={onCreate}
          className="mt-8 w-full rounded-none bg-black text-white"
        />
      </div>
    </Modal>
  );
}

export function useCreateFunnelModal({
  onSelectFunnel,
}: {
  onSelectFunnel?: (funnel: FunnelProps) => void;
} = {}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelProps | null>(null);

  const onSelectFunnelRef = useRef(onSelectFunnel);

  useEffect(() => {
    onSelectFunnelRef.current = onSelectFunnel;
  }, [onSelectFunnel]);

  const openCreateFunnelModal = useCallback(() => {
    setEditingFunnel(null);
    setShowListModal(false);
    setShowCreateModal(true);
  }, []);

  const openFunnelListModal = useCallback(() => {
    setShowCreateModal(false);
    setShowListModal(true);
  }, []);

  const openEditFunnelModal = useCallback((funnel: FunnelProps) => {
    setEditingFunnel(funnel);
    setShowListModal(false);
    setShowCreateModal(true);
  }, []);

  const handleSelectFunnel = useCallback((funnel: FunnelProps) => {
    onSelectFunnelRef.current?.(funnel);
    setShowListModal(false);
  }, []);

  const CreateFunnelEditorModalComponent = useCallback(
    () => (
      <CreateFunnelEditorModal
        showModal={showCreateModal}
        setShowModal={setShowCreateModal}
        editingFunnel={editingFunnel}
      />
    ),
    [editingFunnel, showCreateModal]
  );

  const FunnelListModalComponent = useCallback(
    () => (
      <FunnelListModal
        showModal={showListModal}
        setShowModal={setShowListModal}
        onCreate={openCreateFunnelModal}
        onEdit={openEditFunnelModal}
        onSelectFunnel={handleSelectFunnel}
      />
    ),
    [
      handleSelectFunnel,
      openCreateFunnelModal,
      openEditFunnelModal,
      showListModal,
    ]
  );

  return useMemo(
    () => ({
      setShowCreateFunnelModal: setShowCreateModal,
      openCreateFunnelModal,
      openFunnelListModal,
      CreateFunnelEditorModal: CreateFunnelEditorModalComponent,
      FunnelListModal: FunnelListModalComponent,
    }),
    [
      openCreateFunnelModal,
      openFunnelListModal,
      CreateFunnelEditorModalComponent,
      FunnelListModalComponent,
    ]
  );
}
