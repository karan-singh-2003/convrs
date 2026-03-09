"use client";

import { Button, useMediaQuery, Label, Input } from "@repo/ui";
import { cn } from "@repo/utils";
import { signIn } from "next-auth/react";
import { useContext } from "react";
import { toast } from "sonner";
import { LoginFormContext } from "./login-form";

export const SSOSignIn = () => {
  const { isMobile } = useMediaQuery();

  const {
    setClickedMethod,
    clickedMethod,
    authMethod,
    setLastUsedAuthMethod,
    setShowSSOOption,
    showSSOOption,
  } = useContext(LoginFormContext);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setClickedMethod("saml");
        fetch("/api/auth/saml/verify", {
          method: "POST",
          body: JSON.stringify({ slug: e.currentTarget.slug.value }),
        }).then(async (res) => {
          const { data, error } = await res.json();
          if (error) {
            toast.error(error);
            setClickedMethod(undefined);
            return;
          }
          setLastUsedAuthMethod("saml");
          await signIn("saml", undefined, {
            tenant: data.workspaceId,
            product: "Boilercode",
          });
        });
      }}
      className="flex flex-col space-y-3"
    >
      {showSSOOption && (
        <div className="flex flex-col gap-y-1.5">
          {authMethod !== "saml" && (
            <div className="mb-3 mt-1 border-t border-neutral-300" />
          )}

          <Label
            htmlFor="slug"
            className="text-sm font-medium font-display text-muted-foreground"
          >
            Workspace Slug
          </Label>

          <Input
            id="slug"
            name="slug"
            autoFocus={!isMobile}
            type="text"
            placeholder="my-team"
            autoComplete="off"
            required
            className={cn(
              "h-10 w-full font-display text-[15.5px] text-neutral-600 transition-opacity"
            )}
          />
        </div>
      )}

      <Button
        text="SAML SSO"
        variant="secondary"
        // icon={<Lock className="size-4" />}
        {...(!showSSOOption && {
          type: "button",
          onClick: (e) => {
            e.preventDefault();
            setShowSSOOption(true);
          },
        })}
        className="font-display text-base text-neutral-600 hover:text-neutral-700 bg-neutral-50 "
        loading={clickedMethod === "saml"}
        disabled={clickedMethod && clickedMethod !== "saml"}
      />
    </form>
  );
};
