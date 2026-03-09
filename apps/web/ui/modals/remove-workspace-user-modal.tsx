import { mutatePrefix } from "@/lib/swr/mutate";
import useWorkspace from "@/lib/swr/use-workspace";
import { UserProps } from "@/lib/types";
import { Avatar, Button, Modal } from "@repo/ui";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { mutate } from "swr";

function RemoveWorkspaceUserModal({
  showRemoveWorkspaceUserModal,
  setShowRemoveWorkspaceUserModal,
  user,
}: {
  showRemoveWorkspaceUserModal: boolean;
  setShowRemoveWorkspaceUserModal: Dispatch<SetStateAction<boolean>>;
  user: Pick<UserProps, "id" | "name" | "email" | "image">;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [removing, setRemoving] = useState(false);
  const { id: workspaceId, name: workspaceName } = useWorkspace();

  const searchParams = useSearchParams();
  const isInvite = searchParams.get("status") === "invited";

  const removeWorkspaceUser = async () => {
    setRemoving(true);

    const response = await fetch(
      `/api/workspaces/${workspaceId}/${
        isInvite
          ? `invites?email=${encodeURIComponent(user.email)}`
          : `users?userId=${user.id}`
      }`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.status === 200) {
      if (session?.user?.email === user.email) {
        await mutate("/api/workspaces");
        router.push("/");
      } else {
        setShowRemoveWorkspaceUserModal(false);
        await mutatePrefix(
          `/api/workspaces/${workspaceId}/${isInvite ? "invites" : "users"}`
        );
      }

      toast.success(
        session?.user?.email === user.email
          ? "You have left the workspace!"
          : isInvite
            ? "Successfully revoked invitation!"
            : "Successfully removed teammate!"
      );
    } else {
      const { error } = await response.json();
      toast.error(error.message);
    }

    setRemoving(false);
  };

  const self = session?.user?.email === user.email;

  const content = (
    <>
      <div className="relative flex items-center gap-2 space-x-3 rounded-none border border-neutral-300 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Avatar user={user} className="size-10" />
          <div className="flex flex-col">
            <p className="text-[13px] font-default font-medium text-neutral-900">
              {user.name || user.email}
            </p>
            <p className="text-[13px] font-default text-neutral-500">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <Button
        text={self ? "Leave" : isInvite ? "Revoke" : "Remove"}
        variant="danger"
        loading={removing}
        onClick={removeWorkspaceUser}
      />
    </>
  );

  return (
    <Modal
      showModal={showRemoveWorkspaceUserModal}
      setShowModal={setShowRemoveWorkspaceUserModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          {isInvite
            ? "Revoke Invitation"
            : self
              ? "Leave Workspace"
              : "Remove Teammate"}
        </h3>
      </div>

      <div className="md:px-5 md:py-4 flex flex-col gap-4">
        {/* Description */}
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 leading-relaxed">
          {isInvite
            ? "This will revoke "
            : self
              ? "You're about to leave "
              : "This will remove "}
          <span className="font-medium text-neutral-700">
            {self ? workspaceName : user.name || user.email}
          </span>
          {isInvite
            ? "'s invitation to join your workspace."
            : self
              ? ". You will lose all access to this workspace."
              : " from your workspace."}{" "}
          Are you sure you want to continue?
        </p>

        {/* User Card */}
        <div className="flex items-center gap-3 border border-neutral-200 bg-neutral-50 px-3 py-3">
          <Avatar user={user} className="size-9 md:size-10" />

          <div className="flex flex-col leading-tight">
            <p className="text-[13px] md:text-[14px] font-medium font-display text-neutral-700">
              {user.name || user.email}
            </p>

            <p className="text-[12.5px] md:text-[13px] font-display text-neutral-500">
              {user.email}
            </p>
          </div>
        </div>

        {/* Action */}
        <Button
          text={
            self
              ? "Leave Workspace"
              : isInvite
                ? "Revoke Invitation"
                : "Remove Teammate"
          }
          variant="danger"
          loading={removing}
          onClick={removeWorkspaceUser}
          className="w-full font-display h-9 md:h-10"
        />
      </div>
    </Modal>
  );
}

export function useRemoveWorkspaceUserModal({ user }: { user: UserProps }) {
  const [showRemoveWorkspaceUserModal, setShowRemoveWorkspaceUserModal] =
    useState(false);

  const RemoveWorkspaceUserModalCallback = useCallback(() => {
    return (
      <RemoveWorkspaceUserModal
        showRemoveWorkspaceUserModal={showRemoveWorkspaceUserModal}
        setShowRemoveWorkspaceUserModal={setShowRemoveWorkspaceUserModal}
        user={user}
      />
    );
  }, [showRemoveWorkspaceUserModal, setShowRemoveWorkspaceUserModal, user]);

  return useMemo(
    () => ({
      setShowRemoveWorkspaceUserModal,
      RemoveWorkspaceUserModal: RemoveWorkspaceUserModalCallback,
    }),
    [setShowRemoveWorkspaceUserModal, RemoveWorkspaceUserModalCallback]
  );
}
