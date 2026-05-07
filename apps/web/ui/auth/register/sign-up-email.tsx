"use client";

import { Input, Button, Label } from "@repo/ui";
import * as z from "zod";
import { signUpSchema } from "@/lib/zod/schemas/auth";
import { FormProvider, useForm } from "react-hook-form";
import { useCallback, useState } from "react";
import { useMediaQuery } from "@repo/ui";
import { useAction } from "next-safe-action/hooks";
import { sendOTPAction } from "@/lib/actions/send-otp";
import { toast } from "sonner";
import { useRegisterContext } from "./context";
import { zodResolver } from "@hookform/resolvers/zod";

type SignUpProps = z.infer<typeof signUpSchema>;

export const SignUpEmail = () => {
  const { isMobile } = useMediaQuery();

  const { setStep, setEmail, setPassword } = useRegisterContext();

  const form = useForm<SignUpProps>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = form;

  const { executeAsync, isPending } = useAction(sendOTPAction, {
    onSuccess: (data) => {
      setEmail(getValues().email);
      setPassword(getValues().password);
      setStep("verify");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ||
          error.validationErrors?.email?.[0] ||
          error.validationErrors?.password?.[0] ||
          "Failed to send OTP."
      );
    },
  });

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      handleSubmit(async (data) => await executeAsync(data))(e);
    },
    [handleSubmit, executeAsync]
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-y-1.5">
        <Label
          htmlFor="email"
          className="text-sm font-medium font-poppins text-neutral-600 text-muted-foreground"
        >
          Email
        </Label>
        <Input
          placeholder="panic@thedis.com"
          autoComplete="email"
          autoFocus={!isMobile}
          {...register("email")}
          error={errors.email?.message}
          className="font-display text-[15.5px] text-neutral-600 hover:text-neutral-700 bg-neutral-50  "
        ></Input>
      </div>

      <div className="flex flex-col gap-y-1.5">
        <Label
          htmlFor="password"
          className="text-sm font-medium font-poppins text-neutral-600 text-muted-foreground"
        >
          Password
        </Label>
        <Input
          type="password"
          placeholder="Create a password"
          autoComplete="new-password"
          autoFocus={!isMobile}
          {...register("password")}
          error={errors.password?.message}
        ></Input>
      </div>

      <Button
        text={isPending ? "Signing Up..." : "Sign Up"}
        className="w-full mt-4 text-white font-display"
        disabled={isPending}
        loading={isPending}
      />
    </form>
  );
};
