"use client";
import { resetPasswordSchema } from "@/lib/zod/schemas/auth";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useParams, useRouter } from "next/navigation";
import { Input, Button, Label } from "@repo/ui";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { PasswordResetRequestAction } from "@/lib/actions/request-password-update";
import { zodResolver } from "@hookform/resolvers/zod";

export const ResetPasswordForm = () => {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to reset password. Please try again.");
      }
      toast.success(
        "Password reset successful! Please login with your new password."
      );
      router.push("/login");
    } catch (error: any) {
      toast.error(
        error.message || "Failed to reset password. Please try again."
      );
    }
  });

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input type="hidden" value={token} {...register("token")} />

        <div>
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your new password"
            {...register("password")}
            error={errors.password ? errors.password.message : ""}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            {...register("confirmPassword")}
            error={errors.confirmPassword ? errors.confirmPassword.message : ""}
          />
        </div>

        <Button
          text="Reset Password"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="text-white"
        />
      </form>
    </>
  );
};
