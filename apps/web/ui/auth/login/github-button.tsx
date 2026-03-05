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
      text=" GitHub"
      variant="secondary"
      onClick={() => {
        setClickedMethod("github");
        setLastUsedAuthMethod("github");
        signIn("github", {
          ...(next && next.length > 0 ? { callbackUrl: next } : {}),
        });
      }}
      className="font-display text-base text-neutral-600 hover:text-neutral-700 bg-neutral-50  "
      loading={clickedMethod === "github"}
      disabled={clickedMethod && clickedMethod !== "github"}
      // icon={<Github className="size-4.5 text-black" />}
    />
  );
};
