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
            <p className="text-[13px] font-default text-neutral-500">{user.email}</p>
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
      className="max-w-md"
    >
      <div className="space-y-2 border-b border-neutral-200 px-4 py-4 sm:px-6">
        <h3 className="text-lg font-medium">
          {isInvite
            ? "Revoke Invitation"
            : self
              ? "Leave Workspace"
              : "Remove Teammate"}
        </h3>
        <p className="text-sm font-default text-neutral-500">
          {isInvite
            ? "This will revoke "
            : self
              ? "You're about to leave "
              : "This will remove "}
          <span className="font-semibold text-black">
            {self ? workspaceName : user.name || user.email}
          </span>
          {isInvite
            ? "'s invitation to join your workspace. "
            : self
              ? ". You will lose all access to this workspace. "
              : " from your workspace. "}
          Are you sure you want to continue?
        </p>
      </div>

      <div className="flex flex-col space-y-4 bg-neutral-50 px-4 py-4 sm:px-6">
        {content}
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
