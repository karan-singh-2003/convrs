import { ForgotPasswordForm } from "@/ui/auth/forgot-password-form";
import { Wordmark } from "@repo/ui";
import Image from "next/image";
import Link from "next/link";
export default function ForgotPasswordPage() {
  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex justify-center">
          <Wordmark />
        </div>
        <div className="flex flex-col my-5 items-center justify-center">
          <h1 className="text-base sm:text-[18px] mt-2 text-neutral-700 font-display font-semibold">
            Reset your password
          </h1>
          <h3 className="text-muted-foreground text-neutral-600 font-medium font-display text-sm sm:text-[14.5px]">
            Enter your email and we’ll send you a reset link.
          </h3>
        </div>
        <div className="my-5">
          <ForgotPasswordForm />
        </div>
        <Link
          href="/login"
          className="block w-full text-center mt-6 font-display text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
