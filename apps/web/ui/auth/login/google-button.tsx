import { Button } from "@repo/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { LoginFormContext } from "./login-form";
import { Google } from "@repo/ui";

export function GoogleButton({ next }: { next?: string }) {
  const searchParams = useSearchParams();
  const finalNext = next ?? searchParams?.get("next");

  const { setClickedMethod, clickedMethod, setLastUsedAuthMethod } =
    useContext(LoginFormContext);

  return (
    <Button
      text="Continue with Google"
      variant="secondary"
      onClick={() => {
        setClickedMethod("google");
        setLastUsedAuthMethod("google");
        signIn("google", {
          ...(finalNext && finalNext.length > 0
            ? { callbackUrl: finalNext }
            : {}),
        });
      }}
      loading={clickedMethod === "google"}
      disabled={clickedMethod && clickedMethod !== "google"}
      icon={<Google className="h-[17px] w-[17px]" />}
    />
  );
}
