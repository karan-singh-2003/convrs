import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { BlurImage, Modal, useMediaQuery } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui";
import { cn } from "@repo/utils";

function DeleteWorkspaceModal({
  showDeleteWorkspaceModal,
  setShowDeleteWorkspaceModal,
}: {
  showDeleteWorkspaceModal: boolean;
  setShowDeleteWorkspaceModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { isMobile } = useMediaQuery();
  const { logo, name, id } = useWorkspace();
  const { slug } = useParams() as { slug: string };
  const [workspaceSlugVerification, setWorkspaceSlugVerification] =
    useState("");
  const [verification, setVerification] = useState("");
  const confirmationText = `confirm delete workspace`;
  return (
    <Modal
      showModal={showDeleteWorkspaceModal}
      setShowModal={setShowDeleteWorkspaceModal}
      className="max-w-md rounded-none"
    >
      <div className="space-y-1.5 border-b border-neutral-200 px-4 py-2 sm:px-6">
        <h3 className="text-base font-medium text-neutral-700">
          Delete Workspace
        </h3>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm font-medium text-neutral-500 font-display">
          Warning: This will permanently delete your workspace, custom domains,
          and all associated links and their respective analytics.
        </p>
        <form action="" className="flex flex-col space-y-4 bg-neutral-50 py-3">
          <div className="relative flex items-center gap-3 rounded-full border border-neutral-300 bg-white px-4 py-2">
            <BlurImage
              src={logo || ""}
              alt="Workspace logo"
              className="size-10 rounded-full"
              width={24}
              height={24}
            />

            <div className="flex flex-1 flex-col gap-0.5">
              <h3 className="line-clamp-1 text-sm font-display font-medium text-neutral-600">
                {name || slug}
              </h3>
              <p className="text-sm font-display text-neutral-500">
                app.dub.co/{slug}
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor="workspace-slug"
              className="block font-display text-sm text-neutral-700"
            >
              Enter the workspace slug{" "}
              <span className="font-semibold">{slug}</span> to continue:
            </label>
            <div className="relative mt-1 rounded-md shadow-sm">
              <input
                type="text"
                name="workspace-slug"
                id="workspace-slug"
                autoFocus={!isMobile}
                autoComplete="off"
                pattern={slug}
                required
                value={workspaceSlugVerification}
                onChange={(e) => setWorkspaceSlugVerification(e.target.value)}
                className={cn(
                  "block w-full rounded-none border-neutral-300 text-neutral-900 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
                )}
              />
            </div>
          </div>

          <div>
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
                autoComplete="off"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                className={cn(
                  "block w-full rounded-none border-neutral-300 text-neutral-900 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
                )}
              />
            </div>
          </div>

          <Button text="Delete" variant="danger" />
        </form>
      </div>
    </Modal>
  );
}

export function useDeleteWorkspaceModal() {
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] =
    useState(false);
  const DeleteWorkspaceModalCallback = useCallback(() => {
    return (
      <DeleteWorkspaceModal
        showDeleteWorkspaceModal={showDeleteWorkspaceModal}
        setShowDeleteWorkspaceModal={setShowDeleteWorkspaceModal}
      />
    );
  }, [showDeleteWorkspaceModal]);

  return useMemo(
    () => ({
      setShowDeleteWorkspaceModal,
      DeleteWorkspaceModal: DeleteWorkspaceModalCallback,
    }),
    [DeleteWorkspaceModalCallback]
  );
}
