import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TwoFactorChallengeForm } from "./form";
import { TWO_FA_COOKIE_NAME } from "@/lib/auth/constants";
import { Wordmark } from "@repo/ui";

export default async function TwoFactorChallengePage() {
  const cookie = (await cookies()).get(TWO_FA_COOKIE_NAME);

  if (!cookie) {
    redirect("/login");
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex justify-center">
          <Wordmark />
        </div>
        <div className="flex flex-col my-5 items-center justify-center">
          <h1 className="text-base sm:text-[18px] text-neutral-700 mt-2 font-display font-semibold">
            Two-factor authentication
          </h1>
          <h3 className="text-muted-foreground text-neutral-600 font-medium font-display text-sm sm:text-[14.5px]">
            Enter your 2FA code to access your account.
          </h3>
        </div>
        <div className="my-5">
          <TwoFactorChallengeForm />
        </div>
      </div>
    </div>
  );
}
