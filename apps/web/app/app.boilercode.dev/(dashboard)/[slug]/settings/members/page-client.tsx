"use client";
import { Button, Avatar, Popover, Table, useTable } from "@repo/ui";
import { useInviteWorkspaceUserModal } from "@/ui/modals/invite-workspace-user-modal";
import { useInviteCodeModal } from "@/ui/modals/invite-code-modal";
import useSWR from "swr";
import useWorkspace from "@/lib/swr/use-workspace";
import { useSearchParams } from "next/navigation";
import { fetcher } from "@repo/utils";
import { WorkspaceUserProps } from "@/lib/types";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Ellipsis } from "lucide-react";
import { useRemoveWorkspaceUserModal } from "@/ui/modals/remove-workspace-user-modal";
import { useWorkspaceUserRoleModal } from "@/ui/modals/update-workspace-user-role-modal";
import { ColumnDef } from "@tanstack/react-table";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { MoreHorizontal } from "lucide-react";

export default function WorkspacePeopleClient() {
  const { setShowInviteWorkspaceUserModal, InviteWorkspaceUserModal } =
    useInviteWorkspaceUserModal();
  const { setShowInviteCodeModal, InviteCodeModal } = useInviteCodeModal();

  const { id: workspaceId, role } = useWorkspace();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") as "active" | "invited") || null;
  const search = searchParams.get("search") || "";

  // fetching workspace members
  const {
    data: users,
    error,
    isLoading,
  } = useSWR<WorkspaceUserProps[]>(
    workspaceId &&
      `/api/workspaces/${workspaceId}/${status === "invited" ? "invites" : "users"}?${new URLSearchParams(
        {
          ...(search && { search }),
        }
      ).toString()}`,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  const isCurrentUserOwner = role === "owner";
  const columns = useMemo<ColumnDef<WorkspaceUserProps>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Name
          </span>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-700 border border-neutral-200">
                {user.name.charAt(0).toUpperCase()}
              </div>

              {/* Name + Email */}
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium font-display text-neutral-600">
                  {user.name}
                </span>
                <span className="text-sm text-neutral-500 font-display">
                  {user.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Role
          </span>
        ),
        cell: ({ row }) => {
          const role = row.original.role;

          return (
            <span className="text-sm font-display text-neutral-700">
              {role}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        cell: () => (
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
            <MoreHorizontal size={16} className="text-neutral-500" />
          </button>
        ),
      },
    ],
    []
  );
  const { table, ...tableProps } = useTable<WorkspaceUserProps>({
    data: users || [],
    columns,
    loading: isLoading,
    error: undefined,
  });
  return (
    <>
      <InviteWorkspaceUserModal />
      <InviteCodeModal />
      <SettingsChildrenLayout
        title="Members"
        description="Invite people and assign organization roles."
        actions={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-x-2">
              {/* <Button
                text="Copy Invite Link"
                className="text-white h-fit font-display rounded-full text-[12.5px] py-1"
                onClick={() => setShowInviteCodeModal(true)}
              ></Button> */}
              <Button
                text="Invite Member"
                variant="secondary"
                className="text-black/60  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
                onClick={() => setShowInviteWorkspaceUserModal(true)}
              ></Button>
            </div>
          </div>
        }
        className="my-4"
      >
        {/* Table */}

        <Table table={table} {...tableProps} />
      </SettingsChildrenLayout>
    </>
  );
}

function RowMenuButton({
  user,
  isCurrentUserOwner,
}: {
  user: WorkspaceUserProps;
  isCurrentUserOwner: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  const searchParams = useSearchParams();
  const isInvite = searchParams.get("status") === "invited";

  const { RemoveWorkspaceUserModal, setShowRemoveWorkspaceUserModal } =
    useRemoveWorkspaceUserModal({
      user: {
        id: user.id || "",
        name: user.name || "",
        email: user.email || "",
        image: user.image || "",
        createdAt: user.createdAt,
        provider: null,
      },
    });

  const isCurrentUser = session?.user?.email === user.email;

  // Only show menu if user is owner OR they're removing themselves
  if (!isCurrentUserOwner && !isCurrentUser) {
    return null;
  }

  return (
    <>
      <RemoveWorkspaceUserModal />
      <Popover
        openPopover={isOpen}
        setOpenPopover={setIsOpen}
        content={
          <div className="w-fit">
            <Button
              className="w-full text-[13px] font-default justify-start text-white"
              onClick={() => {
                setShowRemoveWorkspaceUserModal(true);
                setIsOpen(false);
              }}
              text={isInvite ? "Remove Invite" : "Remove from Workspace"}
            ></Button>
          </div>
        }
        align="end"
      >
        <Button
          type="button"
          className="h-8 whitespace-nowrap px-2 disabled:border-transparent disabled:bg-transparent "
          variant="outline"
          icon={<Ellipsis className="h-4 w-4 shrink-0" />}
        />
      </Popover>
    </>
  );
}
