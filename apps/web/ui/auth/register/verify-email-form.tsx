"use client";

import { createUserAccountAction } from "@/lib/actions/create-user-account";
import { AnimatedSizeContainer, Button, useMediaQuery } from "@repo/ui";
import { cn } from "@repo/utils";
import { OTPInput } from "input-otp";
import { signIn } from "next-auth/react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRegisterContext } from "./context";
import { ResendOtp } from "./resend-otp";

export const VerifyEmailForm = () => {
  const router = useRouter();
  const { isMobile } = useMediaQuery();
  const [code, setCode] = useState("");
  const { email, password } = useRegisterContext();
  const [isInvalidCode, setIsInvalidCode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { executeAsync, isPending } = useAction(createUserAccountAction, {
    async onSuccess() {
      toast.success("Account created! Redirecting to dashboard...");
      setIsRedirecting(true);

      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (response?.ok) {
        router.push("/onboarding/new");
      } else {
        toast.error(
          "Failed to sign in with credentials. Please try again or contact support."
        );
      }
    },
    onError({ error }) {
      toast.error(error.serverError);
      setCode("");
      setIsInvalidCode(true);
    },
  });

  if (!email || !password) {
    router.push("/register");
    return;
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeAsync({ email, password, code });
        }}
      >
        <div>
          <OTPInput
            maxLength={6}
            value={code}
            onChange={(code) => {
              setIsInvalidCode(false);
              setCode(code);
            }}
            autoFocus={!isMobile}
            render={({ slots }) => (
              <div className="flex gap-x-0.5 my-4 w-full items-center justify-between">
                {slots.map(({ char, isActive, hasFakeCaret }, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative flex h-[72px] w-[77px] items-center justify-center font-display text-[24px]",
                      "rounded-none border-b-[3px] border-[#E0E0E0] bg-neutral-100 ring-0 transition-all",
                      isActive && "border-[#9E9E9E]",
                      isInvalidCode && "border-[#c51d1d]"
                    )}
                  >
                    {char}
                    {hasFakeCaret && (
                      <div className="animate-caret-blink pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-px bg-black" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            onComplete={() => {
              executeAsync({ email, password, code });
            }}
          />
          <AnimatedSizeContainer height>
            {isInvalidCode && (
              <p className="pt-3 text-center text-sm font-display font-medium text-red-500">
                Invalid code. Please try again.
              </p>
            )}
          </AnimatedSizeContainer>

          <Button
            className="mt-8 font-display w-full max-w-sm mx-auto"
            text={isPending ? "Verifying..." : "Continue"}
            type="submit"
            loading={isPending || isRedirecting}
            disabled={!code || code.length < 6}
          />
        </div>
      </form>

      <ResendOtp email={email} />
    </div>
  );
};
