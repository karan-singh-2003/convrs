import { Modal } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { UpgradePlanPricingCard } from "@/ui/upgrade-plan-pricing-card";

function UpgradePlanModal({
  showUpgradePlanModal,
  setShowUpgradePlanModal,
}: {
  showUpgradePlanModal: boolean;
  setShowUpgradePlanModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <Modal
      showModal={showUpgradePlanModal}
      setShowModal={setShowUpgradePlanModal}
      className="w-full max-w-[780px] rounded-none p-0 sm:rounded-[0px]"
      desktopOnly={true}
    >
      <UpgradePlanPricingCard />
    </Modal>
  );
}

// Was named useCreateWorkspaceModal before this refactor — a copy-paste
// leftover from adapting the workspace-creation modal's pattern. Renamed
// since it wraps UpgradePlanModal, not workspace creation.
export function useUpgradePlanModal() {
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);

  const UpgradePlanModalCallback = useCallback(() => {
    return (
      <UpgradePlanModal
        showUpgradePlanModal={showUpgradePlanModal}
        setShowUpgradePlanModal={setShowUpgradePlanModal}
      />
    );
  }, [showUpgradePlanModal, setShowUpgradePlanModal]);

  return useMemo(
    () => ({
      setShowUpgradePlanModal,
      UpgradePlanModal: UpgradePlanModalCallback,
    }),
    [setShowUpgradePlanModal, UpgradePlanModalCallback]
  );
}