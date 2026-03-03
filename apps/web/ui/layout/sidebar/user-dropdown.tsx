"use client";

import { signOut, useSession } from "next-auth/react";
import { Popover, Avatar, Button, BlurImage } from "@repo/ui";
import { ComponentPropsWithoutRef, ElementType, useState } from "react";
import { cn } from "@repo/utils";
import Link from "next/link";

export function UserDropdown() {
  const { data: session } = useSession();
  const [openPopover, setOpenPopover] = useState(false);

  const menuOptions: Array<{
    label: string;
    href?: string;
    onClick: () => void;
  }> = [
    {
      label: "Account Settings",
      href: "/account/settings",
      onClick: () => setOpenPopover(false),
    },
    {
      label: "Log out",
      onClick: () =>
        signOut({
          callbackUrl: "/login",
        }),
    },
  ];

  console.log("session in user dropdown", session);
  return (
    <Popover
      content={
        <div className="flex w-full flex-col space-y-px rounded-none bg-white p-2 sm:min-w-64">
          {session?.user ? (
            <div className="px-2 pb-4 sm:pb-2">
              <p className="truncate text-base font-medium text-neutral-900 sm:text-sm">
                {session.user.name || session.user.email?.split("@")[0]}
              </p>
              <p className="truncate text-base text-neutral-500 sm:text-sm">
                {session.user.email}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 px-2 py-3">
              <div className="h-3 w-12 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-neutral-200" />
            </div>
          )}
          {menuOptions.map((menuOption, idx) => (
            <UserOption
              key={idx}
              as={menuOption.href ? Link : "button"}
              {...menuOption}
            />
          ))}
        </div>
      }
      align="start"
      openPopover={openPopover}
      setOpenPopover={setOpenPopover}
    >
      <button
        onClick={() => setOpenPopover(!openPopover)}
        className={cn(
          "group relative  flex  items-center justify-center rounded-none transition-all",
          "hover:bg-bg-inverted/5 active:bg-bg-inverted/10 data-[state=open]:bg-bg-inverted/10 transition-colors duration-150",
          "outline-none focus-visible:ring-2 focus-visible:ring-black/50 "
        )}
      >
        {session?.user ? (
          <div className="flex items-center gap-2 px-3">
            {session.user.image ? (
              <BlurImage
                src={session.user.image}
                alt="User avatar"
                className="size-7 rounded-full bg-neutral-100 object-cover sm:size-8"
                height={18}
                width={18}
              />
            ) : (
              <Avatar
                user={session.user}
                className="size-6 border-none duration-75 sm:size-7"
              />
            )}
            </div>
        ) : (
          <div className="size-7 animate-pulse rounded-full bg-neutral-100" />
        )}
      </button>
    </Popover>
  );
}

type UserOptionProps<T extends ElementType> = {
  as?: T;
  label: string;
};
function UserOption<T extends ElementType = "button">({
  as,
  label,
  icon: Icon,
  children,
  ...rest
}: UserOptionProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof UserOptionProps<T>>) {
  const Component = as ?? "button";

  return (
    <Component
      className="flex items-center gap-x-4 rounded-none px-2.5 py-1.5 text-base transition-all duration-75 hover:bg-neutral-200/50 active:bg-neutral-200/80 sm:text-sm"
      {...rest}
    >
      {/* <Icon className="size-5 text-neutral-500 sm:size-4" /> */}
      <span className="block truncate text-neutral-600">{label}</span>
      {children}
    </Component>
  );
}
