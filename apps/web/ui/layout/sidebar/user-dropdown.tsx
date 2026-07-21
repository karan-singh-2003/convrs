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


  return (
    <Popover
      content={
        <div className="flex w-full flex-col  rounded-md sm:min-w-64">
          {/* User Info */}
          {session?.user ? (
            <div className="px-3 py-3 sm:py-2">
              <p className="truncate text-[13.5px] sm:text-sm font-display font-medium text-content-default">
                {session.user.name || session.user.email?.split("@")[0]}
              </p>

              <p className="truncate text-[13.5px] sm:text-sm font-display text-content-subtle">
                {session.user.email}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 px-3 py-3">
              <div className="h-3 w-16 animate-pulse rounded-full bg-bg-emphasis" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-bg-emphasis" />
            </div>
          )}

          {/* Menu Options */}
          <div className="py-1 border-t border-border-subtle">
            {menuOptions.map((menuOption, idx) => (
              <UserOption
                key={idx}
                as={menuOption.href ? Link : "button"}
                {...menuOption}
              />
            ))}
          </div>
        </div>
      }
      align="start"
      openPopover={openPopover}
      setOpenPopover={setOpenPopover}
    >
      <button
        onClick={() => setOpenPopover(!openPopover)}
        className={cn(
          "group relative flex items-center justify-center rounded-none pr-1 outline-none transition-colors duration-150",
          "hover:bg-bg-emphasis active:bg-bg-default data-[state=open]:bg-bg-default",
          "focus-visible:ring-2 focus-visible:ring-border-default"
        )}
      >
        {session?.user ? (
          <div className="flex items-center gap-1 ">
            {session.user.image ? (
              <BlurImage
                src={session.user.image}
                alt="User avatar"
                className="h-[22px] w-[22px] md:h-[25px] md:w-[25px] rounded-full object-cover"
                width={26}
                height={26}
              />
            ) : (
              <Avatar user={session.user} className="h-6 w-6 border-none" />
            )}
          </div>
        ) : (
          <div className="h-6 w-6 animate-pulse rounded-full bg-bg-emphasis" />
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
      className="
        flex w-fit  items-center 
        px-3 py-1
        text-[14px] sm:text-sm
        font-display font-medium
        text-content-subtle
        transition-colors
        hover:text-content-default
        
      "
      {...rest}
    >
      {Icon && <Icon className="size-5 sm:size-4 text-content-subtle" />}

      <span className="flex-1 truncate">{label}</span>

      {children}
    </Component>
  );
}
