// add-goal-modal.tsx
import { Modal } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import useWorkspace from "@/lib/swr/use-workspace";

function AddGoalModal({
  showAddGoalModal,
  setShowAddGoalModal,
}: {
  showAddGoalModal: boolean;
  setShowAddGoalModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { id: workspaceId, slug: workspaceSlug } = useWorkspace();
  const { mutate: globalMutate } = useSWRConfig();
  const workspaceIdOrSlug = workspaceSlug ?? workspaceId;

  const [eventName, setEventName] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmed = eventName.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 100;

  const handleSave = async () => {
    if (!workspaceIdOrSlug || !canSave) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceIdOrSlug}/tracked-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to add goal");
      }

      toast.success(`Added "${trimmed}" as a goal`);
      setEventName("");
      setShowAddGoalModal(false);

      await globalMutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/workspaces/${workspaceIdOrSlug}/tracked-events`),
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
    <Modal
      showModal={showAddGoalModal}
      setShowModal={setShowAddGoalModal}
      className="max-h-[90vh] px-4 py-3 md:max-h-[95dvh] md:overflow-y-auto md:px-0 md:py-1.5"
    >
      <div className="space-y-1 md:border-b md:border-border-subtle md:py-1">
        <h3 className="px-0 font-display text-[16px] font-medium text-content-default md:px-5 md:text-[17.5px]">
          Add a Goal
        </h3>
      </div>

      <div className="space-y-4 md:px-5 md:py-4">
        <p className="font-display text-[13px] text-content-subtle md:text-[14.5px]">
          Name the event you want to track as a goal, then fire it from your site
          whenever it happens (e.g. a signup or purchase).
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="goal-event-name"
            className="font-display text-[13px] font-medium text-content-default"
          >
            Event name
          </label>

          <input
            id="goal-event-name"
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="checkout_completed"
            maxLength={100}
            className="w-full rounded-xl border border-border-subtle bg-bg-subtle px-4 py-2 font-display text-[14.5px] text-content-default placeholder:text-content-subtle transition-colors focus:border-border-default focus:bg-bg-card focus:outline-none focus:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave && !saving) handleSave();
            }}
          />

          <p className="font-display text-[12px] text-content-muted">
            Letters, numbers, underscores, and hyphens only.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-bg-inverted px-4 py-2 font-display text-[14px] font-medium text-content-inverted transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Adding..." : "Add Goal"}
        </button>
      </div>
    </Modal>
  );
}

export function useAddGoalModal() {
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);

  const AddGoalModalCallback = useCallback(() => {
    return (
      <AddGoalModal
        showAddGoalModal={showAddGoalModal}
        setShowAddGoalModal={setShowAddGoalModal}
      />
    );
  }, [showAddGoalModal, setShowAddGoalModal]);

  return useMemo(
    () => ({
      setShowAddGoalModal,
      AddGoalModal: AddGoalModalCallback,
    }),
    [setShowAddGoalModal, AddGoalModalCallback]
  );
}