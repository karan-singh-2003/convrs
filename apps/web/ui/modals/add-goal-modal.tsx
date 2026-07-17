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
      className="px-4 py-3 md:px-0 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Add a Goal
        </h3>
      </div>

      <div className="md:py-4 md:px-5 gap-y-5 space-y-4">
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Name the event you want to track as a goal, then fire it from your
          site whenever it happens (e.g. a signup or purchase).
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="goal-event-name"
            className="text-[13px] font-display font-medium text-neutral-600"
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
            className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2 font-display text-[14.5px] text-neutral-600 placeholder:text-neutral-400 focus:outline-none focus:ring-0 focus:border-neutral-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave && !saving) handleSave();
            }}
          />
          <p className="text-[12px] font-display text-neutral-400">
            Letters, numbers, underscores, and hyphens only.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 font-display text-[14px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
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