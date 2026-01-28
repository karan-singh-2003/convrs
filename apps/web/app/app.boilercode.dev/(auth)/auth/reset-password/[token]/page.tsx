import { ResetPasswordForm } from "@/ui/auth/reset-password-form";
import { prisma } from "@repo/db";

interface ResetPasswordPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
    
  const resolvedParams = await props.params;
  const { token } = resolvedParams;

  const validToken = await isValidToken(token);

  if (!isValidToken) {
    return (
      <div className="flex h-screen justify-center items-center">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-xl font-semibold">
            Invalid or Expired Token
          </h1>
          <p className="mt-4 text-center text-sm text-gray-600">
            The password reset link is invalid or has expired. Please request a
            new password reset.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen justify-center items-center">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold">Reset Password</h1>
        <div className="mt-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
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
