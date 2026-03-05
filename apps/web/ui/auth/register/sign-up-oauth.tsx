"use client";

import { Button, Github, Google } from "@repo/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const SignUpOAuth = ({
  methods,
}: {
  methods: ("email" | "google" | "github")[];
}) => {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next");
  const [clickedGoogle, setClickedGoogle] = useState(false);
  const [clickedGithub, setClickedGithub] = useState(false);

  useEffect(() => {
    // when leave page, reset state
    return () => {
      setClickedGoogle(false);
      setClickedGithub(false);
    };
  }, []);

  return (
    <>
      {methods.includes("google") && (
        <Button
          text="Continue with Google"
          onClick={() => {
            setClickedGoogle(true);
            signIn("google", {
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            });
          }}
          className="font-display text-base text-neutral-600 hover:text-neutral-700 bg-neutral-50  "
          loading={clickedGoogle}
        />
      )}
      {methods.includes("github") && (
        <Button
          text="Continue with GitHub"
          onClick={() => {
            setClickedGithub(true);
            signIn("github", {
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            });
          }}
          className="font-display text-base text-neutral-600 hover:text-neutral-700 bg-neutral-50  "
          loading={clickedGithub}
        />
      )}
    </>
  );
};
