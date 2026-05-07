"use client";
import { checkAccountExistsAction } from "@/lib/actions/check-account-exists";
import { Button, Input, Label, useMediaQuery } from "@repo/ui";
import { cn } from "@repo/utils";
import { signIn } from "next-auth/react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useState } from "react";
import { toast } from "sonner";
import { errorCodes, LoginFormContext } from "./login-form";

export const EmailSignIn = ({ next }: { next?: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const finalNext = next ?? searchParams?.get("next");
  const { isMobile } = useMediaQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const {
    showPasswordField,
    setShowPasswordField,
    setClickedMethod,
    authMethod,
    setAuthMethod,
    clickedMethod,
    setLastUsedAuthMethod,
    setShowSSOOption,
  } = useContext(LoginFormContext);

  const { executeAsync, isPending } = useAction(checkAccountExistsAction, {
    onError: ({ error }) => {
      toast.error(String(error.serverError || "An error occurred"));
    },
  });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();

        if (!showPasswordField) {
          const result = await executeAsync({ email });
          if (!result?.data) return;

          const { accountExists, hasPassword } = result.data as {
            accountExists: boolean;
            hasPassword: boolean;
          };

          if (accountExists && hasPassword) {
            setShowPasswordField(true);
            return;
          }

          if (!accountExists) {
            setClickedMethod(undefined);
            toast.error("No account found with that email address.");
            return;
          }
        }

        setClickedMethod("email");

        const result = await executeAsync({ email });
        if (!result?.data) return;

        const { accountExists, hasPassword } = result.data as {
          accountExists: boolean;
          hasPassword: boolean;
        };

        if (!accountExists) {
          setClickedMethod(undefined);
          toast.error("No account found with that email address.");
          return;
        }

        const provider = password && hasPassword ? "credentials" : "email";

        const response = await signIn(provider, {
          email,
          redirect: false,
          callbackUrl: finalNext || "/workspaces",
          ...(password && { password }),
        });

        if (!response) return;

        if (!response.ok && response.error) {
          if (response.error === "2FA token required.") {
            router.push("/two-factor-challenge");
            return;
          }

          toast.error(
            errorCodes[response.error as keyof typeof errorCodes] ??
              response.error
          );

          setClickedMethod(undefined);
          return;
        }

        setLastUsedAuthMethod("email");

        if (provider === "email") {
          toast.success("Email sent — check your inbox!");
          setEmail("");
          setClickedMethod(undefined);
          return;
        }

        if (provider === "credentials") {
          router.push(response?.url || finalNext || "/workspaces");
        }
      }}
      className="flex flex-col gap-y-4"
    >
      {authMethod === "email" && (
        <div className="flex flex-col gap-y-1.5">
          <Label
            htmlFor="email"
            className="text-sm font-medium font-poppins text-neutral-600 text-muted-foreground"
          >
            Email
          </Label>
          <Input
            id="email"
            name="email"
            autoFocus={!isMobile && !showPasswordField}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size={1}
            className={cn(
              "h-10 w-full font-display text-[15.5px] text-neutral-600 transition-opacity",
              isPending && "opacity-60 pointer-events-none"
            )}
          />
        </div>
      )}

      {showPasswordField && (
        <div className="flex flex-col gap-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-sm font-medium font-display text-muted-foreground"
            >
              Password
            </Label>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(email)}`}
              className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoFocus={!isMobile}
            value={password}
            placeholder="Enter your password"
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 font-display w-full text-[15.5px] text-neutral-600 transition-opacity"
          />
        </div>
      )}

      <Button
        text={`Continue with ${password ? "password" : "email"}`}
        {...(authMethod !== "email" && {
          type: "button",
          onClick: (e) => {
            e.preventDefault();
            setShowSSOOption(false);
            setAuthMethod("email");
          },
        })}
        className="mt-1 h-10 w-full font-display bg-black text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
        loading={clickedMethod === "email" || isPending}
        disabled={Boolean(clickedMethod && clickedMethod !== "email")}
      />
    </form>
  );
};