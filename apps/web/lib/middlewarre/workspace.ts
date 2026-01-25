import { UserProps } from "@/lib/types";

import { NextRequest, NextResponse } from "next/server";
import { getDefaultWorkspace } from "./utils/get-default-workspace";

import { parse } from "./utils/parse";

export async function WorkspacesMiddleware(req: NextRequest, user: UserProps) {
  const { path, searchParamsObj, searchParamsString } = parse(req);

  // Handle ?next= query param with proper validation to prevent open redirects
  if (searchParamsObj.next) {
    return NextResponse.redirect(new URL(searchParamsObj.next, req.url));
  }

  const defaultWorkspace = await getDefaultWorkspace(user);

  // If user has a default workspace, redirect them to it
  if (defaultWorkspace) {
    let redirectPath = path;
    if (["/", "/login", "/register", "/workspaces"].includes(path)) {
      redirectPath = "";
    }

    return NextResponse.redirect(
      new URL(
        `/${defaultWorkspace}${redirectPath}${searchParamsString}`,
        req.url
      )
    );
  }

  // No default workspace or invite found, redirect to workspace onboarding
  return NextResponse.redirect(new URL("/onboarding/workspace", req.url));
}
