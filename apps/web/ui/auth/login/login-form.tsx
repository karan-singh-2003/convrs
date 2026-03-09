"use client";

import { AnimatedSizeContainer } from "@repo/ui";
import { useLocalStorage } from "@repo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { AuthMethodsSeparator } from "../auth-methods-separator";
import { EmailSignIn } from "./email-sign-in";
import { GitHubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { SSOSignIn } from "./sso-login";
import { Passkey } from "./passkey";

export const authMethods = [
  "google",
  "github",
  "passkey",
  "saml",
  "email",
  "password",
] as const;

export type AuthMethod = (typeof authMethods)[number];

export const errorCodes = {
  "no-credentials": "Please provide an email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "exceeded-login-attempts":
    "Account has been locked due to too many login attempts. Please contact support to unlock your account.",
  "too-many-login-attempts": "Too many login attempts. Please try again later.",
  "email-not-verified": "Please verify your email address.",
  "2FA token required.": "Two-factor authentication required.",
  "two-factor-required": "Two-factor authentication required.",
  "invalid-2fa-code": "Invalid 2FA code. Please try again.",
  "no-2fa-token": "2FA session expired. Please login again.",
  "too-many-2fa-attempts": "Too many 2FA attempts. Please try again later.",
  "framer-account-linking-not-allowed":
    "It looks like you already have an account with us. Please sign in with your Framer account email instead.",
  "require-saml-sso":
    "Your organization requires authentication through your company's identity provider.",
  Callback:
    "We encountered an issue processing your request. Please try again or contact support if the problem persists.",
  OAuthSignin:
    "There was an issue signing you in. Please ensure your provider settings are correct.",
  OAuthCallback:
    "We faced a problem while processing the response from the OAuth provider. Please try again.",
};

export const LoginFormContext = createContext<{
  authMethod: AuthMethod | undefined;
  setAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  clickedMethod: AuthMethod | undefined;
  showPasswordField: boolean;
  showSSOOption: boolean;
  setShowPasswordField: Dispatch<SetStateAction<boolean>>;
  setClickedMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setLastUsedAuthMethod: (value: AuthMethod | undefined) => void;
  setShowSSOOption: Dispatch<SetStateAction<boolean>>;
}>({
  authMethod: undefined,
  setAuthMethod: () => {},
  clickedMethod: undefined,
  showPasswordField: false,
  showSSOOption: false,
  setShowPasswordField: () => {},
  setClickedMethod: () => {},
  setLastUsedAuthMethod: () => {},
  setShowSSOOption: () => {},
});

export default function LoginForm({ next }: { next?: string }) {
  const searchParams = useSearchParams();
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showSSOOption, setShowSSOOption] = useState(false);
  const [clickedMethod, setClickedMethod] = useState<AuthMethod | undefined>(
    undefined
  );
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>("email");

  const router = useRouter();

  const [, setLastUsedAuthMethod] = useLocalStorage<AuthMethod | undefined>(
    "last-used-auth-method",
    undefined
  );

  useEffect(() => {
    const error = searchParams?.get("error");
    if (!error) return;

    // OAuth 2FA: redirect straight to the challenge page instead of showing a toast
    if (error === "two-factor-required") {
      router.replace("/two-factor-challenge");
      return;
    }

    toast.error(
      errorCodes[error as keyof typeof errorCodes] ||
        "An unexpected error occurred. Please try again later."
    );
  }, [searchParams, router]);

  // Reset the state when leaving the page
  useEffect(() => () => setClickedMethod(undefined), []);

  return (
    <LoginFormContext.Provider
      value={{
        authMethod,
        setAuthMethod,
        clickedMethod,
        showPasswordField,
        showSSOOption,
        setShowPasswordField,
        setClickedMethod,
        setLastUsedAuthMethod: (value) => setLastUsedAuthMethod(value),
        setShowSSOOption,
      }}
    >
      <div className="flex flex-col gap-3">
        <AnimatedSizeContainer height>
          <div className="flex flex-col gap-3 p-1">
            {/* Google */}
            <GoogleButton next={next} />

            {/* GitHub */}
            <GitHubButton />

            {/* Passkey */}
            <Passkey next={next} />

            {/* SSO */}
            {/* <SSOSignIn /> */}

            <AuthMethodsSeparator />

            {/* Email */}
            <EmailSignIn next={next} />
          </div>
        </AnimatedSizeContainer>
      </div>
    </LoginFormContext.Provider>
  );
}
