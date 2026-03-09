import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Modal, Button } from "@repo/ui";
import useSAML from "@/lib/swr/use-saml";
import { SAML_PROVIDERS } from "@repo/utils";
import { useMediaQuery } from "@repo/ui";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";

function RemoveSAMLModal({
  showRemoveSAMLModal,
  setShowRemoveSAMLModal,
}: {
  showRemoveSAMLModal: boolean;
  setShowRemoveSAMLModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { isMobile } = useMediaQuery();
  const { id } = useWorkspace();
  const { provider, saml, mutate } = useSAML();
  const currentProvider = useMemo(
    () => SAML_PROVIDERS.find((p) => p.name.startsWith(provider!)),
    [provider]
  );

  const confirmationText = `remove ${currentProvider?.name} SAML`;
  const [verification, setVerification] = useState("");
  const [removing, setRemoving] = useState(false);

  const removeSAML = async () => {
    setRemoving(true);
    const { clientID, clientSecret } = saml.connections[0];
    const params = new URLSearchParams({
      clientID,
      clientSecret,
    });
    const res = await fetch(`/api/workspaces/${id}/saml?${params}`, {
      method: "DELETE",
    });
    setRemoving(false);
    if (res.ok) {
      await mutate();
      setShowRemoveSAMLModal(false);
      toast.success("SAML removed successfully");
    } else {
      const { error } = await res.json();
      toast.error(error.message);
    }
  };
  return (
    <Modal
      showModal={showRemoveSAMLModal}
      setShowModal={setShowRemoveSAMLModal}
      className="py-2 px-4 md:px-0 min-h-[33dvh] md:max-h-fit md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Remove SAML
        </h3>
      </div>

      <div className="md:py-4 md:px-5">
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 w-full">
          This will remove SAML from your {process.env.NEXT_PUBLIC_APP_NAME}{" "}
          workspace.
        </p>

        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 mt-1">
          <span className="font-medium">This action can't be undone</span>
          <span> — proceed with caution.</span>
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await removeSAML();
          }}
          className="flex flex-col mt-4 mb-2 space-y-4"
        >
          {/* Provider Card */}
          <div className="relative flex items-center gap-3 bg-neutral-100/50 py-2.5 px-3 md:py-3">
            <img
              src={currentProvider!.logo}
              alt={currentProvider!.name + " logo"}
              className="h-5 w-5 md:h-6 md:w-6"
            />
            <h3 className="line-clamp-1 font-display text-[13px] md:text-[14.5px] font-medium text-neutral-500">
              {currentProvider!.name} SAML
            </h3>
          </div>

          {/* Verification Input */}
          <div className="my-3 md:my-4">
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
            text="Remove SAML"
            variant="danger"
            loading={removing}
            disabled={verification !== confirmationText}
            className="h-9 md:h-10 text-sm"
          />
        </form>
      </div>
    </Modal>
  );
}

export function useRemoveSAMLModal() {
  const [showRemoveSAMLModal, setShowRemoveSAMLModal] = useState(false);

  const RemoveSAMLModalCallback = useCallback(() => {
    return (
      <RemoveSAMLModal
        showRemoveSAMLModal={showRemoveSAMLModal}
        setShowRemoveSAMLModal={setShowRemoveSAMLModal}
      />
    );
  }, [showRemoveSAMLModal, setShowRemoveSAMLModal]);

  return useMemo(
    () => ({
      setShowRemoveSAMLModal,
      RemoveSAMLModal: RemoveSAMLModalCallback,
    }),
    [setShowRemoveSAMLModal, RemoveSAMLModalCallback]
  );
}
