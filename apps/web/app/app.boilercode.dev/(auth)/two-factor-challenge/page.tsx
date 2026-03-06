import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TwoFactorChallengeForm } from "./form";
import { TWO_FA_COOKIE_NAME } from "@/lib/auth/constants";

export default async function TwoFactorChallengePage() {
  const cookie = (await cookies()).get(TWO_FA_COOKIE_NAME);

  if (!cookie) {
    redirect("/login");
  }

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

          <h1 className="text-base sm:text-[18px] mt-2 font-display font-semibold">
            Two-factor authentication
          </h1>
          <h3 className="text-muted-foreground font-medium font-display text-sm sm:text-[14.5px]">
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
