"use client";
import useWorkspaceUsers from "@/lib/swr/use-workspace-users";
import useWorkspaces from "@/lib/swr/use-workspaces";
import { WorkspaceProps } from "@/lib/types";
import { Check2, Popover, BlurImage } from "@repo/ui";
import { pluralize } from "@repo/utils";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, useRef } from "react";
import { cn } from "@repo/utils";
import { ChevronDown, Plus } from "lucide-react";
import { useScrollProgress } from "@repo/ui";

export function WorkspaceDropdown() {
  const { workspaces } = useWorkspaces();
  const { data: session, status } = useSession();
  const { slug: currentSlug } = useParams<{ slug: string }>();
  const [openPopover, setOpenPopover] = useState(false);

  const selected = useMemo(() => {
    const selectedWorkspace = workspaces?.find(
      (workspace) => workspace.slug === currentSlug
    );

    if (currentSlug && workspaces && selectedWorkspace) {
      return {
        ...selectedWorkspace,
        image:
          selectedWorkspace.logo ||
          `https://avatar.vercel.sh/${selectedWorkspace.id}`,
      };

      // return personal account selector if there's no workspace or error (user doesn't have access to workspace)
    } else {
      return {
        name: session?.user?.name || session?.user?.email,
        image:
          session?.user?.image ||
          `https://avatar.vercel.sh/${session?.user?.email}`,
      };
    }
  }, [currentSlug, workspaces, session]) as {
    id?: string;
    name: string;
    slug: string;
    image: string;
  };

  if (status === "loading" || !workspaces) {
    return <WorkspaceDropdownPlaceholder />;
  }
  return (
    <div className="">
      <Popover
        side="bottom"
        align="start"
        openPopover={openPopover}
        setOpenPopover={setOpenPopover}
        content={
          <WorkspaceList
            workspaces={workspaces}
            selected={selected}
            setOpenPopover={setOpenPopover}
          />
        }
      >
        <button
          onClick={() => setOpenPopover(!openPopover)}
          className="gap-2 flex items-center bg-[#F0F0F0] p-1.5 rounded-full w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <BlurImage
              src={selected.image}
              alt={selected.name}
              className=" rounded-full"
              width={21}
              height={21}
              draggable={false}
            />
            <span className="truncate font-medium font-default text-[14px]">
              {selected.name}
            </span>
          </div>
          <ChevronDown className="size-3.5 text-neutral-500" />
        </button>
      </Popover>
    </div>
  );
}

function WorkspaceList({
  workspaces,
  selected,
  setOpenPopover,
}: {
  workspaces: WorkspaceProps[];
  selected: {
    id?: string;
    name: string;
    slug: string;
    image: string;
  };
  setOpenPopover: (open: boolean) => void;
}) {
  const { users } = useWorkspaceUsers();
  const membersCount = users?.length || 0;
  console.log("users", users);
  console.log("membersCount", membersCount);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollProgress, updateScrollProgress } = useScrollProgress(scrollRef);
  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        onScroll={updateScrollProgress}
        className="w-xs md:max-h-84 relative w-full overflow-auto rounded-none bg-white text-base sm:w-[300px] sm:text-sm"
      >
        {/* Current workspace section */}
        <div className="flex flex-col gap-2.5 border-b border-neutral-200 px-3 pb-3 sm:p-2">
          <div className="flex items-center gap-x-2.5">
            <BlurImage
              src={selected.image}
              width={21}
              height={21}
              alt={selected.name}
              className=" shrink-0 overflow-hidden rounded-full "
              draggable={false}
            />
            <div className="min-w-0 flex items-center gap-x-1 justify-between w-full">
              <div className="truncate font-display  font-medium leading-5 text-neutral-500 text-[14px] sm:text-sm">
                {selected.name}
              </div>
              {selected.slug && (
                <div
                  className={cn(
                    "truncate text-sm capitalize font-display text-neutral-500 leading-tight sm:text-xs"
                  )}
                >
                  {membersCount > 0
                    ? ` · ${membersCount} ${pluralize("member", membersCount)}`
                    : ""}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Workspaces section */}
        <div className="flex flex-col gap-2.5 border-b border-neutral-200  px-1 ">
          <div>
            <p className="px-2 py-1.5 text-[12px] font-default  text-neutral-600">
              Workspaces
            </p>
            <div className="flex flex-col ">
              {workspaces.map(({ id, name, slug, logo }) => {
                const isActive = selected.slug === slug;
                return (
                  <Link
                    key={slug}
                    className={cn(
                      "relative flex w-full items-center gap-x-2 rounded-none px-2 py-1.5 transition-all duration-75",
                      "hover:bg-neutral-200/50 active:bg-neutral-200/80",
                      "outline-none focus-visible:ring-2 focus-visible:ring-black/50",
                      isActive && "bg-neutral-200/50"
                    )}
                    href={`/${slug}`}
                    shallow={false}
                    onClick={() => setOpenPopover(false)}
                  >
                    <BlurImage
                      src={logo || `https://avatar.vercel.sh/${id}`}
                      width={24}
                      height={24}
                      alt={id}
                      className="size-5 shrink-0 overflow-hidden rounded-full"
                      draggable={false}
                    />
                    <span className="block truncate font-display leading-5 text-neutral-600 sm:max-w-[140px] text-[13px] sm:text-[12.5px]">
                      {name}
                    </span>
                    {selected.slug === slug ? (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-black">
                        <Check2 className="size-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              <button
                key="add"
                onClick={() => {
                  setOpenPopover(false);
                  // setShowAddWorkspaceModal(true);
                }}
                className="group flex w-full cursor-pointer items-center gap-x-2.5 rounded-none px-2 py-1 my-1 text-neutral-500 transition-all duration-75 hover:bg-neutral-200/50 active:bg-neutral-200/80"
              >
                <Plus className="ml-0.5 size-4 text-neutral-500" />
                <span className="block truncate font-display text-[12.5px]  font-medium py-0.5  text-neutral-600/85 leading-5 text-neutral-500 sm:text-[14px]">
                  Create workspace
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="p-1">
          <div className="flex flex-col mb-1">
            <Link
              href={`/${selected.slug ? selected.slug : "account"}/settings`}
              className="
        flex items-center gap-x-4
        rounded-none font-medium font-display text-[14px] px-2.5 py-1 w-full
        transition-all duration-75
        hover:bg-neutral-200/50
        active:bg-neutral-200/80
        sm:text-sm text-neutral-500
      "
              onClick={() => setOpenPopover(false)}
            >
              Settings
            </Link>

            {selected.slug && (
              <Link
                href={`/${selected.slug}/settings/members`}
                className="
          flex items-center gap-x-4
          rounded-none font-display  font-medium text-[14px] text-neutral-600/85 px-2.5 py-1 w-full
          transition-all duration-75
          hover:bg-neutral-200/50
          active:bg-neutral-200/80
          sm:text-[14px]  text-neutral-500
        "
                onClick={() => setOpenPopover(false)}
              >
                Invite members
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceDropdownPlaceholder() {
  return (
    <button className="gap-2 flex items-center bg-[#F0F0F0] p-1.5 rounded-full w-full justify-between">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-neutral-200" />
      </div>
    </button>
  );
}
