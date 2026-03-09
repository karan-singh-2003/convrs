import { UserProps } from "@/lib/types";

import { NextRequest, NextResponse } from "next/server";
import { getDefaultWorkspace } from "./utils/get-default-workspace";

import { parse } from "./utils/parse";
import { sql } from "@repo/db/edge";

type PendingInviteRow = {
  slug: string;
};

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

  // Before sending to onboarding, check whether this user has a pending
  // email-based workspace invite. If yes, redirect them to accept it so they
  // join the workspace instead of creating a new one.
  if (user.email) {
    try {
      const rows = await sql`
        SELECT w.slug
        FROM "WorkspaceInvite" wi
        JOIN "Workspace" w ON w.id = wi."workspaceId"
        WHERE wi.email = ${user.email}
          AND wi.expires >= NOW()
        LIMIT 1
      `;
      const invite = rows[0] as PendingInviteRow | undefined;
      if (invite?.slug) {
        return NextResponse.redirect(
          new URL(`/${invite.slug}/invite`, req.url)
        );
      }
    } catch {
      // DB error — fall through to onboarding
    }
  }

  // No default workspace or invite found, redirect to workspace onboarding
  return NextResponse.redirect(new URL("/onboarding/workspace", req.url));
}
