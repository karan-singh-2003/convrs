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
    <div className="w-full max-w-sm">
      <h3 className="text-center text-xl font-semibold">
        Two-factor authentication
      </h3>

      <div className="mt-8">
        <TwoFactorChallengeForm />
      </div>
    </div>
  );
}
