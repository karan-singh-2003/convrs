import { mutatePrefix } from "@/lib/swr/mutate";
import useWorkspace from "@/lib/swr/use-workspace";
import { UserProps } from "@/lib/types";
import { WorkspaceRole } from "@repo/db/client";
import { Avatar, Button, Modal } from "@repo/ui";
import { useSearchParams } from "next/navigation";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

const ROLES: { value: WorkspaceRole; label: string; description: string }[] = [
  {
    value: "owner",
    label: "Owner",
    description: "Full access, can manage billing and members",
  },
  {
    value: "member",
    label: "Member",
    description: "Can view and edit workspace resources",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Can view workspace resources only",
  },
  {
    value: "billing",
    label: "Billing",
    description: "Can manage billing settings only",
  },
];

function WorkspaceUserRoleModal({
  showWorkspaceUserRoleModal,
  setShowWorkspaceUserRoleModal,
  user,
  role,
}: {
  showWorkspaceUserRoleModal: boolean;
  setShowWorkspaceUserRoleModal: Dispatch<SetStateAction<boolean>>;
  user: UserProps;
  role: WorkspaceRole;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(role);
  const { id } = useWorkspace();
  const { id: userId, name, email } = user;

  const searchParams = useSearchParams();
  const isInvite = searchParams.get("status") === "invited";

  // Reset selected role when the modal opens with a potentially different user
  const handleOpen = (open: boolean) => {
    if (open) setSelectedRole(role);
    setShowWorkspaceUserRoleModal(open);
  };

  const updateRole = async () => {
    setEditing(true);

    try {
      const endpoint = isInvite
        ? `/api/workspaces/${id}/invites`
        : `/api/workspaces/${id}/users`;
      const body = isInvite
        ? { email, role: selectedRole }
        : { userId, role: selectedRole };

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error.message);
      }

      await mutatePrefix(
        `/api/workspaces/${id}/${isInvite ? "invites" : "users"}`
      );
      setShowWorkspaceUserRoleModal(false);
      toast.success(`Successfully updated the role to ${selectedRole}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setEditing(false);
    }
  };

  return (
    <Modal
      showModal={showWorkspaceUserRoleModal}
      setShowModal={handleOpen}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          {isInvite ? "Update Invitation Role" : "Update Member Role"}
        </h3>
      </div>

      <div className="md:px-5 md:py-4 flex flex-col gap-4">
        {/* User Card */}
        <div className="flex items-center gap-3 border border-neutral-200 bg-neutral-50 px-3 py-3">
          <Avatar user={user} className="size-9 md:size-10" />
          <div className="flex flex-col leading-tight">
            {isInvite ? (
              <p className="text-[13px] md:text-[14px] font-medium font-display text-neutral-700">
                {user.email}
              </p>
            ) : (
              <>
                <p className="text-[13px] md:text-[14px] font-medium font-display text-neutral-700">
                  {user.name || user.email}
                </p>
                <p className="text-[12.5px] md:text-[13px] font-display text-neutral-500">
                  {user.email}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Role selector */}
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-medium font-display text-neutral-600">
            Select a role
          </p>
          <div className="flex flex-col gap-1.5">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`flex items-start k gap-3 cursor-pointer border rounded-none px-3 py-2.5 transition-colors ${
                  selectedRole === r.value
                    ? "border-neutral-400 bg-neutral-50"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={selectedRole === r.value}
                  onChange={() => setSelectedRole(r.value)}
                  className="mt-0.5 accent-black outline-none checked:border-black checked:bg-black active:checked:bg-black hover:checked:bg-black ring-0 focus:ring-0 focus:outline-none"
                />
              
                <div className="flex flex-col leading-tight">
                  <span className="text-[13.5px] font-medium font-display text-neutral-700">
                    {r.label}
                  </span>
                  <span className="text-[12px] font-display text-neutral-400">
                    {r.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button
          text="Confirm"
          loading={editing}
          disabled={selectedRole === role}
          onClick={updateRole}
          className="w-full font-display text-white h-9 md:h-10"
        />
      </div>
    </Modal>
  );
}

export function useWorkspaceUserRoleModal({
  user,
  role,
}: {
  user: UserProps;
  role: WorkspaceRole;
}) {
  const [showWorkspaceUserRoleModal, setShowWorkspaceUserRoleModal] =
    useState(false);

  const WorkspaceUserRoleModalCallback = useCallback(() => {
    return (
      <WorkspaceUserRoleModal
        showWorkspaceUserRoleModal={showWorkspaceUserRoleModal}
        setShowWorkspaceUserRoleModal={setShowWorkspaceUserRoleModal}
        user={user}
        role={role}
      />
    );
  }, [showWorkspaceUserRoleModal, setShowWorkspaceUserRoleModal, user, role]);

  return useMemo(
    () => ({
      setShowWorkspaceUserRoleModal,
      WorkspaceUserRoleModal: WorkspaceUserRoleModalCallback,
    }),
    [setShowWorkspaceUserRoleModal, WorkspaceUserRoleModalCallback]
  );
}
