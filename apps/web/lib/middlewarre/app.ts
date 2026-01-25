import { NextRequest, NextResponse } from "next/server";
import { onboardingStepCacheEdge, ONBOARDING_WINDOW_SECONDS } from "./utils/onboarding-cache-edge";
import { getDefaultWorkspace } from "./utils/get-default-workspace";
import { getUserViaToken } from "./utils/get-user-via-token";
import { hasPendingInvites } from "./utils/has-pending-invites";
import { parse } from "./utils/parse";
import { WorkspacesMiddleware } from "./workspace";

export async function AppMiddleware(req: NextRequest) {
  const { path, fullPath, searchParamsString } = parse(req);

  const user = await getUserViaToken(req);

  // if there's no user and the path isn't /login or /register, redirect to /login
  if (
    !user &&
    path !== "/login" &&
    path !== "/forgot-password" &&
    path !== "/register" &&
    path !== "/auth/saml" &&
    !path.startsWith("/auth/reset-password/")
  ) {
    return NextResponse.redirect(
      new URL(
        `/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`,
        req.url
      )
    );

    // if there's a user
  } else if (user) {
    // /new is a special path that creates a new link (or workspace if the user doesn't have one yet)
    if (path === "/new") {
      console.log("REDIRECTING /NEW PATH");
      console.error("REDIRECTING /NEW PATH");

      /* Prevent users with workspace from accessing /onboarding/workspace */
    } else if (path === "/onboarding/workspace" && (await getDefaultWorkspace(user))) {
      return NextResponse.redirect(new URL("/", req.url));

      /* Onboarding redirects

        - User was created less than a day ago
        - User is not invited to a workspace (redirect straight to the workspace)
        - The path does not start with /onboarding
        - User doesn't have a default workspace
        - User has not completed the onboarding flow
      */
    } else if (
      new Date(user.createdAt).getTime() >
        Date.now() - ONBOARDING_WINDOW_SECONDS * 1000 &&
      !["/onboarding", "/account"].some((p) => path.startsWith(p)) &&
      !(await getDefaultWorkspace(user)) &&
      !(await hasPendingInvites({ req, user })) &&
      (await onboardingStepCacheEdge.get({ userId: user.id })) !== "completed"
    ) {
      let step = await onboardingStepCacheEdge.get({ userId: user.id });
      if (!step) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      } else if (step === "completed") {
        return WorkspacesMiddleware(req, user);
      }

      const defaultWorkspace = await getDefaultWorkspace(user);

      if (defaultWorkspace) {
        // Skip workspace step if user already has a workspace
        step = step === "workspace" ? "plan" : step;
        return NextResponse.redirect(
          new URL(`/onboarding/${step}?workspace=${defaultWorkspace}`, req.url)
        );
      } else {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      // if the path is / or /login or /register, redirect to the default workspace
    } else if (
      [
        "/",
        "/login",
        "/register",
        "/workspaces",
        "/links",
        "/analytics",
        "/events",
        "/customers",
        "/program",
        "/programs",
        "/settings",
        "/upgrade",
        "/guides",
        "/wrapped",
      ].includes(path) ||
      path.startsWith("/program/") ||
      path.startsWith("/settings/")
    ) {
      return WorkspacesMiddleware(req, user);
    }
  }

  // otherwise, rewrite the path to /app
  return NextResponse.rewrite(new URL(`/app.acme.co${fullPath}`, req.url));
}
