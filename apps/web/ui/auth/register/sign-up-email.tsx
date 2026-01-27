"use client";

import { Input,Button } from "@repo/ui";
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

  const [showPass, setShowPass] = useState(false);
  const { setStep, setEmail, lockEmail,setPassword } = useRegisterContext();

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
      const { email, password } = getValues();
      if (!password) {
        e.preventDefault();
        e.stopPropagation();
        setShowPass(true);
        return;
      }
      handleSubmit(async (data) => await executeAsync(data))(e);
    },
    [handleSubmit, executeAsync]
  );
  console.log(errors);
  return (
    <form onSubmit={onSubmit}>
      <div>
        <Input
          placeholder="panic@thedis.com"
          autoComplete="email"
          readOnly={!errors.email && lockEmail}
          autoFocus={!isMobile}
          {...register("email")}
          error={errors.email?.message}
        ></Input>
      </div>

      {showPass && (
        <>
          <div>
            <Input
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              readOnly={!showPass}
              autoFocus={!isMobile}
              {...register("password")}
              error={errors.password?.message}
            ></Input>
          
          </div>
        </>
      )}

      <Button
        text={isPending ? "Signing Up..." : "Sign Up"}
        className="w-full mt-4 text-white"
        disabled={isPending}
        loading={isPending}
      />
    </form>
  );
};
