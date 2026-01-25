import { ForgotPasswordForm } from "@/ui/auth/forgot-password-form";
export default function ForgotPasswordPage() {
  return (
    <div className="flex h-screen justify-center items-center">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold">Forgot Password</h1>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
