"use client";

import useSCIM from "@/lib/swr/use-scim";
import useWorkspace from "@/lib/swr/use-workspace";
import { useRemoveSCIMModal } from "@/ui/modals/remove-scim-modal";
import { useSCIMModal } from "@/ui/modals/scim-modal";
import { Button } from "@repo/ui";
import { SAML_PROVIDERS } from "@repo/utils";
import { useMemo } from "react";
import Section from "./sections";

export function SCIM() {
  const { role } = useWorkspace();
  const { SCIMModal, setShowSCIMModal } = useSCIMModal();
  const { RemoveSCIMModal, setShowRemoveSCIMModal } = useRemoveSCIMModal();
  const { provider, configured, loading } = useSCIM();

  const providerData = useMemo(() => {
    if (configured && provider) {
      return SAML_PROVIDERS.find((p) => p.scim === provider);
    }
    return null;
  }, [provider, configured]);

  return (
    <>
      <SCIMModal />
      {configured && <RemoveSCIMModal />}

      <div className="relative flex flex-col gap-5 ">
        <Section
          title="Directory Sync (SCIM)"
          description={
            configured && providerData
              ? `Directory sync is active with ${providerData.name}.`
              : "Automatically provision and deprovision users from your identity provider."
          }
          buttonLabel={configured ? "Remove" : "Configure"}
          onButtonClick={() => {
            if (configured) {
              setShowRemoveSCIMModal(true);
            } else {
              setShowSCIMModal(true);
            }
          }}
          showRequirement={false}
          configured={configured}
        />
      </div>
    </>
  );
}
