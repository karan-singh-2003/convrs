import { ResetPasswordForm } from "@/ui/auth/reset-password-form";
import { prisma } from "@repo/db";
import { Suspense } from "react";

interface ResetPasswordPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const resolvedParams = await props.params;
  const { token } = resolvedParams;

  const validToken = await isValidToken(token);

  // if (!isValidToken) {
  //   return (
  //     <div className="flex h-screen justify-center items-center">
  //       <div className="w-full max-w-sm">
  //         <h1 className="text-center text-xl font-semibold">
  //           Invalid or Expired Token
  //         </h1>
  //         <p className="mt-4 text-center text-sm text-gray-600">
  //           The password reset link is invalid or has expired. Please request a
  //           new password reset.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="max-w-sm mx-auto px-4 md:px-0 py-8">
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

          <h1 className="text-[20px] mt-4 font-display font-semibold">
            Reset Your Password
          </h1>

          <h3 className="text-muted-foreground font-medium font-display text-[16px] text-center">
            Enter a new password to regain access to your account.
          </h3>
        </div>

        <ResetPasswordForm  />

        <p className="font-medium text-[14px] font-display text-center mt-5 text-muted-foreground">
          Remember your password?{" "}
          <a href="/login" className="text-black">
            Log in
          </a>
        </p>
      </div>
    </Suspense>
  );
}

const isValidToken = async (token: string) => {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token, expires: { gte: new Date() } },
    select: {
      token: true,
    },
  });
  return !!resetToken;
};
