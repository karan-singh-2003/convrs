import { ForgotPasswordForm } from "@/ui/auth/forgot-password-form";
import Image from "next/image";
import Link from "next/link";
export default function ForgotPasswordPage() {
  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col my-5 items-center justify-center">
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

          <h1 className="text-[20px] mt-2 font-display font-semibold">
            Reset your password
          </h1>
          <h3 className="text-muted-foreground font-medium font-display text-[16px]">
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
