"use client";

import useSAML from "@/lib/swr/use-saml";
import useWorkspace from "@/lib/swr/use-workspace";
import { useRemoveSAMLModal } from "@/ui/modals/remove-saml-modal";
import { useSAMLModal } from "@/ui/modals/saml-modal";
import { Button, useOptimisticUpdate, Switch } from "@repo/ui";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import Section from "./sections";

export function SAML() {
  const { id: workspaceId } = useWorkspace();
  const { SAMLModal, setShowSAMLModal } = useSAMLModal();
  const { RemoveSAMLModal, setShowRemoveSAMLModal } = useRemoveSAMLModal();
  const { configured } = useSAML();

  const {
    data: workspaceData,
    isLoading,
    update,
  } = useOptimisticUpdate<{
    ssoEnforcedAt: string | null;
  }>(`/api/workspaces/${workspaceId}`, {
    loading: "Saving SAML SSO login setting...",
    success: "SAML SSO login setting has been updated successfully.",
    error: "Failed to update SAML SSO login settings.",
  });

  const handleSSOEnforcementChange = async (enforceSAML: boolean) => {
    if (!configured) {
      return;
    }

    const updateWorkspace = async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enforceSAML }),
      });
 

      if (!response.ok) {
        const { error } = await response.json();
        toast.error(error.message);
      }

      const data = await response.json();

      return {
        ssoEnforcedAt: data.ssoEnforcedAt,
      };
    };

    await update(updateWorkspace, {
      ssoEnforcedAt: enforceSAML ? new Date().toISOString() : null,
    });
  };

  return (
    <>
      {configured ? <RemoveSAMLModal /> : <SAMLModal />}

      <div className="relative flex flex-col gap-5 ">
        <Section
          title="SAML Single Sign-On (SSO)"
          description={
            configured
              ? "SAML SSO is configured for your workspace."
              : "Allow members to authenticate using your identity provider and enforce SAML login for this workspace."
          }
          buttonLabel={configured ? "Remove" : "Configure"}
          onButtonClick={() => {
            if (configured) {
              setShowRemoveSAMLModal(true);
            } else {
              setShowSAMLModal(true);
            }
          }}
          showRequirement={configured}
          configured={configured}
          ssoEnforcedAt={workspaceData?.ssoEnforcedAt}
          isLoading={isLoading}
          handleSSOEnforcementChange={handleSSOEnforcementChange}
        />
      </div>
    </>
  );
}
