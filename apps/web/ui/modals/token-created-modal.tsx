import { Modal } from "@repo/ui";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
  useMemo,
} from "react";
import { toast } from "sonner";
import { Button, useCopyToClipboard, Copy } from "@repo/ui";
import { Check } from "lucide-react";

function TokenCreatedModal({
  showTokenCreatedModal,
  setShowTokenCreatedModal,
  token,
}: {
  showTokenCreatedModal: boolean;
  setShowTokenCreatedModal: Dispatch<SetStateAction<boolean>>;
  token: string;
}) {
  const [copied, copyToClipboard] = useCopyToClipboard();
  return (
    <Modal
      showModal={showTokenCreatedModal}
      setShowModal={setShowTokenCreatedModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          API Key Created
        </h3>
      </div>

      <div className="md:px-5 md:py-4">
        {/* Description */}
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          For security reasons, we will only show you the key once. Please copy
          and store it somewhere safe.
        </p>

        <div className="flex flex-col space-y-5 py-4">
          {/* API Key */}
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] md:text-sm font-display font-medium text-neutral-700">
              API Key
            </h2>

            <div className="flex items-center justify-between gap-3 border border-neutral-200 bg-white px-3 py-2">
              <p className="font-mono text-[13px] md:text-sm text-neutral-500 break-all">
                {token}
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.promise(copyToClipboard(token), {
                    success: "Copied to clipboard!",
                  });
                }}
                type="button"
                className="flex items-center gap-2 border border-neutral-200 bg-white px-2 py-1 text-[12px] md:text-xs font-medium hover:bg-neutral-50"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-neutral-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-neutral-500" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Button */}
          <Button
            text="Done"
            onClick={() => setShowTokenCreatedModal(false)}
            className="font-display h-9 md:h-10 text-sm"
          />
        </div>
      </div>
    </Modal>
  );
}

export function useTokenCreatedModal({ token }: { token: string }) {
  const [showTokenCreatedModal, setShowTokenCreatedModal] = useState(false);
  const TokenCreatedModalCallback = useCallback(() => {
    return (
      <TokenCreatedModal
        showTokenCreatedModal={showTokenCreatedModal}
        setShowTokenCreatedModal={setShowTokenCreatedModal}
        token={token}
      />
    );
  }, [showTokenCreatedModal, setShowTokenCreatedModal]);

  return useMemo(
    () => ({
      setShowTokenCreatedModal,
      TokenCreatedModal: TokenCreatedModalCallback,
    }),
    [TokenCreatedModalCallback, setShowTokenCreatedModal]
  );
}
