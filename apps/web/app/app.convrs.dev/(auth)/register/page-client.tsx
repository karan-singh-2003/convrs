"use client";
import React from "react";
import { SignUpForm } from "@/ui/auth/register/sign-up-form";
import {
  RegisterProvider,
  useRegisterContext,
} from "@/ui/auth/register/context";
import { VerifyEmailForm } from "@/ui/auth/register/verify-email-form";
import { Wordmark } from "@repo/ui";

export default function RegisterPageClient() {
  return (
    <RegisterProvider>
      <RegisterFlow />
    </RegisterProvider>
  );
}

function SignUp() {
  return (
    <div className="max-w-sm mx-auto py-4 px-4 md:px-0">
      <div className="flex flex-col my-5 items-center justify-center">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <h1 className="text-[21px] text-neutral-700 font-display font-semibold">Get Started</h1>
        <h3 className="text-muted-foreground text-neutral-600 font-medium font-display text-[15px]">
          It’s free for up to 10 users - no credit card needed.
        </h3>
      </div>
      <SignUpForm />
      <p className="font-medium font-display text-[14px] text-center mt-4 text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-black">
          Log In
        </a>
      </p>
    </div>
  );
}

function Verify() {
  const { email, password } = useRegisterContext();
  return (
    <>
      <div className="max-w-md mx-auto py-8">
        <div className="flex flex-col my-5 items-center justify-center">
          <h1 className="text-xl font-semibold my-4 font-display">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 182 199"
              fill="none"
              className="size-8"
            >
              <path
                d="M0 50.837L90.3333 0L182 50.837V148.832L90.3333 199L0 148.832V50.837Z"
                fill="#363636"
              />
              <path
                d="M10 50.0038L90.1639 5L173 49.6679L90.832 94L10 50.0038Z"
                fill="white"
              />
            </svg>
          </h1>
          <h1 className="text-[21px] font-display font-semibold">
            We emailed you a code
          </h1>
          <h3 className="text-muted-foreground text-center font-medium font-display text-[15px]">
            We sent a six digit code to <span>{email}</span>. Enter the code
            below
          </h3>
        </div>
        <VerifyEmailForm />
      </div>
    </>
  );
}

const RegisterFlow = () => {
  const { step } = useRegisterContext();

  if (step === "signup") {
    return <SignUp />;
  }
  return <Verify />;
};
