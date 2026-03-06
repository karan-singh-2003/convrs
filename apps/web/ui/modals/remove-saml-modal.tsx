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
      className="max-w-md"
    >
      <div className="space-y-2 md:border-b md:border-neutral-200 px-4 py-2">
        <h3 className="text-base font-display font-medium">Remove SAML</h3>
      </div>
      <div className="px-4 py-2">
        <p className="text-sm font-display text-neutral-500">
          This will remove SAML from your {process.env.NEXT_PUBLIC_APP_NAME}{" "}
          workspace.{" "}
          <strong className="font-semibold text-neutral-700">
            This action can't be undone
          </strong>{" "}
          — proceed with caution.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await removeSAML();
          }}
          className="flex flex-col my-4 space-y-4"
        >
          <div className="relative flex items-center gap-3 rounded-full border border-neutral-300 bg-white py-2 px-3">
            <img
              src={currentProvider!.logo}
              alt={currentProvider!.name + " logo"}
              className="h-5 w-5"
            />
            <h3 className="line-clamp-1 font-display text-sm font-medium text-neutral-600">
              {currentProvider!.name} SAML
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
            text="Remove SAML"
            variant="danger"
            loading={removing}
            disabled={verification !== confirmationText}
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
