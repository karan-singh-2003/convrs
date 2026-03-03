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
  const {id} = useWorkspace();
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
    >
      <div className="flex flex-col items-center justify-center  border-b border-neutral-200 px-4 py-8 sm:px-16">
        <h3 className="text-lg font-medium">Remove SAML</h3>
        <p className="text-center text-sm text-neutral-500">
          This will remove SAML from your
          {process.env.NEXT_PUBLIC_APP_NAME} workspace. This action cannot be
          undone.
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await removeSAML();
        }}
        className="px-3 space-y-4 my-2"
      >
        <div className="relative flex items-center gap-3 rounded-none border border-neutral-300 bg-white p-2">
          <img
            src={currentProvider!.logo}
            alt={currentProvider!.name + " logo"}
            className="h-5 w-5"
          />
          <h3 className="line-clamp-1 text-sm font-medium text-neutral-600">
            {currentProvider!.name} SAML
          </h3>
        </div>
        <div>
          <label
            htmlFor="verification"
            className="block text-sm text-neutral-700"
          >
            To verify, type{" "}
            <span className="font-semibold">{confirmationText}</span> below
          </label>
          <div className="relative mt-1 rounded-md shadow-sm">
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
              className="block w-full rounded-none border-neutral-300 text-neutral-900 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
            />
          </div>
        </div>
        <Button text="Remove SAML" variant="danger" loading={removing} />
      </form>
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
