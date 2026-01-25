"use client";
import X from "@/ui/shared/icons/x";
import { Button } from "@repo/ui/index";
import Link from "next/link";

export function CloseInviteButton({
  goToOnboarding,
  variant = "x",
}: {
  goToOnboarding?: boolean;
  variant?: "x" | "full";
}) {
  return (
    <Link href={goToOnboarding ? "/onboarding" : "/"}>
      <Button
        variant={variant === "x" ? "outline" : "primary"}
        icon={
          variant === "x" ? (
            <X className="text-content-subtle size-5" />
          ) : undefined
        }
        className={
          variant === "x" ? "size-8 p-0 active:scale-95" : "h-9 w-fit "
        }
        text={variant === "x" ? undefined : "Go back"}
      />
    </Link>
  );
}
