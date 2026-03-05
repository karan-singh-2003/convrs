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
      className="max-w-md"
    >
      <div className="space-y-2 border-b border-neutral-200 px-4 py-2 ">
        <h3 className="text-base font-display font-medium">
          Remove SCIM Directory
        </h3>
      </div>
      <div className="px-4 py-2">
        <p className="text-sm font-display text-neutral-500">
          This will remove the currently configured SCIM directory from your
          workspace.{" "}
          <strong className="font-semibold text-neutral-700">
            This action can't be undone
          </strong>{" "}
          proceed with caution.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await removeSCIM();
          }}
          className="flex flex-col my-4  space-y-4"
        >
          <div className="relative flex items-center gap-3 rounded-full border border-neutral-300 bg-white py-2 px-3">
            <img
              src={currentProvider.logo}
              alt={currentProvider.name + " logo"}
              className="h-5 w-5"
            />
            <h3 className="line-clamp-1 font-display text-sm font-medium text-neutral-600">
              {currentProvider.name} SCIM
            </h3>
          </div>

          <div className="my-2">
            <label
              htmlFor="verification"
              className="block font-display text-sm text-neutral-700"
            >
              To verify, type{" "}
              <span className="font-semibold">{confirmationText}</span> below
            </label>
            <div className="relative mt-1 rounded-none shadow-sm">
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
                className="block w-full rounded-none border-neutral-300 text-neutral-900 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-0 sm:text-sm"
              />
            </div>
          </div>

          <Button
            text="Remove SCIM Directory"
            variant="danger"
            loading={removing}
            disabled={!isVerified}
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
