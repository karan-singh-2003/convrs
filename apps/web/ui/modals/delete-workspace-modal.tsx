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
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";

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
  const [isDeleting, setDeleting] = useState(false);
  const router = useRouter();
 
  const { update } = useSession();
  const confirmationText = `confirm delete workspace`;

  async function deleteWorkspace() {
    return new Promise((resolve, reject) => {
      setDeleting(true);
      fetch(`/api/workspaces/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (res) => {
        if (res.ok) {
          await Promise.all([mutate("/api/workspaces"), update()]);
          router.push("/");
          resolve(null);
        } else {
          setDeleting(false);
          const { error } = await res.json();
          reject(error.message);
        }
      });
    });
  }

  return (
    <Modal
      showModal={showDeleteWorkspaceModal}
      setShowModal={setShowDeleteWorkspaceModal}
      className="py-3 md:py-2 px-4 md:px-0 max-h-[90vh] md:max-h-fit md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Delete Workspace
        </h3>
      </div>

      <div className="md:px-5 md:py-4">
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Warning: This will permanently delete your workspace, custom domains,
          and all associated links and their respective analytics.
        </p>

        <form
          className="flex flex-col space-y-4 mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            toast.promise(deleteWorkspace(), {
              loading: "Deleting workspace...",
              success: "Workspace deleted successfully!",
              error: (err) => err,
            });
          }}
        >
          {/* Workspace Card */}
          <div className="bg-neutral-100/50 flex items-center gap-3 rounded-full px-3 py-2 md:px-4">
            <BlurImage
              src={logo || `https://api.dicebear.com/9.x/glass/svg?seed=${id}`}
              alt="Workspace logo"
              className="size-8 md:size-10 rounded-full"
              width={24}
              height={24}
            />

            <div className="flex flex-1 flex-col gap-0.5">
              <h3 className="line-clamp-1 text-[13px] md:text-sm font-display font-medium text-neutral-600">
                {name || slug}
              </h3>
              <p className="text-[12px] md:text-sm font-display text-neutral-500">
                app.{process.env.NEXT_PUBLIC_APP_DOMAIN}/{slug}
              </p>
            </div>
          </div>

          {/* Workspace Slug Input */}
          <div>
            <label
              htmlFor="workspace-slug"
              className="block font-display text-[13px] md:text-[14.5px] text-neutral-600"
            >
              Enter the workspace slug{" "}
              <span className="font-medium">{slug}</span> to continue:
            </label>

            <div className="relative mt-1">
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
                className="block w-full font-display border-neutral-200 text-neutral-600 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-0 text-[13px] md:text-[14.5px] py-2 md:py-2.5"
              />
            </div>
          </div>

          {/* Confirmation Input */}
          <div>
            <label
              htmlFor="verification"
              className="block font-display text-[13px] md:text-[14.5px] text-neutral-600"
            >
              To verify, type{" "}
              <span className="font-medium">{confirmationText}</span> below
            </label>

            <div className="relative mt-1">
              <input
                type="text"
                name="verification"
                id="verification"
                pattern={confirmationText}
                required
                autoComplete="off"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                className="block w-full font-display border-neutral-200 text-neutral-600 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-0 text-[13px] md:text-[14.5px] py-2 md:py-2.5"
              />
            </div>
          </div>

          {/* Button */}
          <Button
            text="Delete"
            variant="danger"
            className="h-9 md:h-10 text-sm"
          />
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
