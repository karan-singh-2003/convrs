import useSCIM from "@/lib/swr/use-scim";
import useWorkspace from "@/lib/swr/use-workspace";
import { SAMLProviderProps } from "@/lib/types";
import { Button, Modal, useMediaQuery } from "@repo/ui";
import { SAML_PROVIDERS } from "@repo/utils";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

function RemoveSCIMModal({
  showRemoveSCIMModal,
  setShowRemoveSCIMModal,
}: {
  showRemoveSCIMModal: boolean;
  setShowRemoveSCIMModal: Dispatch<SetStateAction<boolean>>;
}) {
  const [removing, setRemoving] = useState(false);
  const [verification, setVerification] = useState("");
  const { id: workspaceId } = useWorkspace();
  const { scim, provider, mutate } = useSCIM();

  const currentProvider = useMemo(
    () => SAML_PROVIDERS.find((p) => p.scim === provider),
    [provider]
  ) as SAMLProviderProps;

  const confirmationText = "confirm remove scim";
  const isVerified = verification === confirmationText;

  const { isMobile } = useMediaQuery();

  const removeSCIM = async () => {
    setRemoving(true);
    if (!scim?.directories[0]) {
      toast.error("No SCIM directories found");
      setRemoving(false);
      return;
    }
    const { id } = scim.directories[0];
    const params = new URLSearchParams({
      directoryId: id,
    });

    const res = await fetch(`/api/workspaces/${workspaceId}/scim?${params}`, {
      method: "DELETE",
    });
    setRemoving(false);
    if (res.ok) {
      await mutate();
      setShowRemoveSCIMModal(false);
      toast.success("SCIM directory removed successfully");
    } else {
      const { error } = await res.json();
      toast.error(error.message);
    }
  };

  return (
    <Modal
      showModal={showRemoveSCIMModal}
      setShowModal={setShowRemoveSCIMModal}
      className="px-4 md:px-0 py-3 md:py-1.5 min-h-[33dvh] md:max-h-fit md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Remove SCIM
        </h3>
      </div>

      <div className="md:py-4 md:px-5">
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 w-full">
          This will remove the currently configured SCIM directory from your
          workspace.
        </p>

        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 mt-1">
          <span className="font-medium">This action can't be undone</span>
          <span> — proceed with caution.</span>
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await removeSCIM();
          }}
          className="flex flex-col mt-4 space-y-4"
        >
          {/* Provider Card */}
          <div className="relative flex items-center gap-3 bg-neutral-100/50 py-2.5 px-3 md:py-3">
            <img
              src={currentProvider!.logo}
              alt={currentProvider!.name + " logo"}
              className="h-5 w-5 md:h-6 md:w-6"
            />
            <h3 className="line-clamp-1 font-display text-[13px] md:text-[14.5px] font-medium text-neutral-500">
              {currentProvider!.name} SCIM
            </h3>
          </div>

          {/* Verification Input */}
          <div className="my-3 md:my-5">
            <label
              htmlFor="verification"
              className="block font-display text-[13px] md:text-[14.5px] text-neutral-600"
            >
              To verify, type{" "}
              <span className="text-neutral-500 font-medium">
                {confirmationText}
              </span>{" "}
              below
            </label>

            <div className="relative mt-1">
              <input
                type="text"
                name="verification"
                id="verification"
                pattern={confirmationText}
                required
                autoFocus={!isMobile}
                autoComplete="off"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                className="block w-full font-display border-neutral-200 text-neutral-600 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-0 text-[13px] md:text-[14.5px] py-2 md:py-2.5"
              />
            </div>
          </div>

          {/* Button */}
          <Button
            text="Remove SCIM Directory"
            variant="danger"
            loading={removing}
            disabled={!isVerified}
            className="h-9 md:h-10 text-sm"
          />
        </form>
      </div>
    </Modal>
  );
}

export function useRemoveSCIMModal() {
  const [showRemoveSCIMModal, setShowRemoveSCIMModal] = useState(false);

  const RemoveSCIMModalCallback = useCallback(() => {
    return (
      <RemoveSCIMModal
        showRemoveSCIMModal={showRemoveSCIMModal}
        setShowRemoveSCIMModal={setShowRemoveSCIMModal}
      />
    );
  }, [showRemoveSCIMModal, setShowRemoveSCIMModal]);

  return useMemo(
    () => ({
      setShowRemoveSCIMModal,
      RemoveSCIMModal: RemoveSCIMModalCallback,
    }),
    [setShowRemoveSCIMModal, RemoveSCIMModalCallback]
  );
}
