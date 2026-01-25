import { Button } from "@repo/ui";
import { Github } from "@repo/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { LoginFormContext } from "./login-form";

export const GitHubButton = () => {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next");

  const { setClickedMethod, clickedMethod, setLastUsedAuthMethod } =
    useContext(LoginFormContext);

  return (
    <Button
      text="Continue with GitHub"
      variant="secondary"
      onClick={() => {
        setClickedMethod("github");
        setLastUsedAuthMethod("github");
        signIn("github", {
          ...(next && next.length > 0 ? { callbackUrl: next } : {}),
        });
      }}
      loading={clickedMethod === "github"}
      disabled={clickedMethod && clickedMethod !== "github"}
      icon={<Github className="h-[17px] w-[17px] text-black" />}
    />
  );
};
