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
      className="w-full max-w-[780px] rounded-none p-0 sm:rounded-[24px]"
      desktopOnly={true}
    >
      <UpgradePlanPricingCard />
    </Modal>
  );
}

export function useCreateWorkspaceModal() {
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
