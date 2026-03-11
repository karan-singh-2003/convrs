"use client";
import { Button, Popover, Table, useTable, Input } from "@repo/ui";
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
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useWorkspaceUserRoleModal } from "@/ui/modals/update-workspace-user-role-modal";

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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-700 ">
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
        cell: ({ row }) => (
          <RowMenuButton
            user={row.original}
            isCurrentUserOwner={role === "owner"}
          />
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

  const { id, slug, inviteCode: initialInviteCode } = useWorkspace();
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [resettingLink, setResettingLink] = useState(false);

  async function resetInviteLink() {
    if (!id) return;
    setResettingLink(true);
    try {
      const res = await fetch(`/api/workspaces/${id}/invite-code`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset link");
      const data = await res.json();
      setInviteCode(data.inviteCode);
      toast.success("Invite link reset");
    } catch {
      toast.error("Failed to reset invite link");
    } finally {
      setResettingLink(false);
    }
  }

  return (
    <>
      <InviteWorkspaceUserModal />
      <InviteCodeModal />
      <div className="my-5 space-y-4">
        {/* Header */}
        <div className="px-1 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="font-display text-[16px] font-medium text-[#555555]">
              Members
            </h1>
            <p className="font-display text-[14.5px] font-medium text-[#727272] opacity-90">
              Invite people and assign organization roles.
            </p>
          </div>

          {/* Actions (Buttons) */}
          <div className="flex items-center gap-2">
            <Button
              text="Invite User"
              className="text-black/60  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
              onClick={() => {
                setShowInviteWorkspaceUserModal(true);
              }}
            ></Button>
          </div>
        </div>

        <div className="flex flex-col gap-y-4">
          <div className=" h-fit p-4 space-y-3 bg-[#fafafa] rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-[14.5px] font-medium text-[#555555]">
                  Invite Link
                </h1>
                <p className="font-display text-[14px] mb-0.5 font-medium text-[#727272] opacity-90">
                  Allow other people to join your workspace through the link
                  below.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                text="Reset Link"
                loading={resettingLink}
                onClick={resetInviteLink}
                className=" text-[13.5px] w-fit bg-transparent border-none font-display  h-7 px-3  rounded-full  text-black/60"
              />
            </div>
            <div className="relative w-full">
              <input
                required
                readOnly
                value={`https://app.${process.env.NEXT_PUBLIC_APP_DOMAIN}/invite/${inviteCode || ""}`}
                className="w-full pr-10 text-sm font-display border border-neutral-200 bg-white text-neutral-600 focus:border-neutral-200 focus:outline-none focus:ring-0"
              />

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `https://app.${process.env.NEXT_PUBLIC_APP_DOMAIN}/invite/${inviteCode || ""}`
                  );
                  toast.success("Invite link copied to clipboard");
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="bg-[#fafafa] rounded-2xl ">
            {/* Table */}
            <Table table={table} {...tableProps} />
          </div>
        </div>
      </div>
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

  const { setShowWorkspaceUserRoleModal, WorkspaceUserRoleModal } =
    useWorkspaceUserRoleModal({
      user: {
        id: user.id || "",
        name: user.name || "",
        email: user.email || "",
        image: user.image || "",
        createdAt: user.createdAt,
        provider: null,
      },
      role: user.role,
    });

  const isCurrentUser = session?.user?.email === user.email;

  // Only show menu if user is owner OR they're removing themselves
  if (!isCurrentUserOwner && !isCurrentUser) {
    return null;
  }
 

  return (
    <>
      <RemoveWorkspaceUserModal />
      <WorkspaceUserRoleModal />
      <Popover
        openPopover={isOpen}
        setOpenPopover={setIsOpen}
        content={
          <div className="">
            <Button
              variant="outline"
              className="md:w-full text-[13px] h-fit w-fit py-2 font-default justify-start text-neutral-700 hover:bg-neutral-100 rounded-none"
              onClick={() => {
                setShowRemoveWorkspaceUserModal(true);
                setIsOpen(false);
              }}
              text={isInvite ? "Remove Invite" : "Remove from Workspace"}
            ></Button>
            <Button
              variant="outline"
              className="md:w-full text-[13px] h-fit w-fit py-2 font-default justify-start text-neutral-700 hover:bg-neutral-100 rounded-none"
              onClick={() => {
                setShowWorkspaceUserRoleModal(true);
                setIsOpen(false);
              }}
              disabled={!isCurrentUserOwner || user.role === "owner"}
              text={isCurrentUser ? "Update Role" : "Change Role"}
            ></Button>
          </div>
        }
        align="end"
      >
        <Button
          type="button"
          className="h-8 whitespace-nowrap focus:outline-none focus:ring-0 focus:border-none px-2 disabled:border-transparent text-neutral-400 hover:text-neutral-500 disabled:bg-transparent "
          variant="outline"
          icon={<Ellipsis className="h-4 w-4 shrink-0" />}
        />
      </Popover>
    </>
  );
}
