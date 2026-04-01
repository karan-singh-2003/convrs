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
      className="px-4 w-[22rem] py-2 rounded-[35px] md:px-0 md:py-2.5  max-h-[90vh] h-[500px] md:overflow-y-auto"
      desktopOnly={true}
    >
      <div className="space-y-1 py-1 text-center">
        <h3 className="text-[16px] md:text-[14.5px] md:px-5 font-display font-medium text-black/65">
          Upgrade Plan
        </h3>
      </div>
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
