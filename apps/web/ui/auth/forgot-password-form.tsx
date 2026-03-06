"use client";

import { Input, Label, useMediaQuery, Button } from "@repo/ui";
import * as z from "zod";
import { requestPasswordResetSchema } from "@/lib/zod/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestPasswordResetAction } from "@/lib/actions/request-password-reset";

type ForgotPasswordProps = z.infer<typeof requestPasswordResetSchema>;

export const ForgotPasswordForm = () => {
  const { isMobile } = useMediaQuery();
  const router = useRouter();

  const form = useForm<ForgotPasswordProps>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const { executeAsync, isPending } = useAction(requestPasswordResetAction, {
    onSuccess() {
      toast.success("Password reset email sent. Please check your inbox.");
      router.push("/login");
    },
    onError() {
      toast.error("Failed to send password reset email. Please try again.");
    },
  });

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(async (data) => {
            await executeAsync(data);
          })(e);
        }}
        className="flex flex-col gap-4"
      >
        {/* Email */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="email"
            className="font-display text-sm sm:text-[14.5px] text-neutral-600"
          >
            Email Address
          </Label>

          <Input
            id="email"
            autoFocus={!isMobile}
            {...register("email")}
            placeholder="panic@thedis.com"
            error={errors.email ? errors.email.message : ""}
            className="font-display text-sm sm:text-[14.5px]"
          />
        </div>

        {/* Button */}
        <Button
          type="submit"
          text="Reset Password"
          disabled={isPending}
          className="w-full text-white font-display py-2 sm:py-2.5"
        />
      </form>
    </div>
  );
};