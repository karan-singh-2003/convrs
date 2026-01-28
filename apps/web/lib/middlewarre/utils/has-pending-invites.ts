import { UserProps } from "@/lib/types";
import { sql } from "@repo/db/edge";
import { NextRequest } from "next/server";

type PendingInviteCountRow = {
  count: number;
};

export async function hasPendingInvites({
  req,
  user,
}: {
  req: NextRequest;
  user: UserProps;
}) {
  // Fast path: invite token or invite route
  if (
    req.nextUrl.searchParams.get("invite") ||
    req.nextUrl.pathname.startsWith("/invites/")
  ) {
    return true;
  }

  const rows = await sql`
  SELECT COUNT(*)::int AS count
  FROM "WorkspaceInvite"
  WHERE email = ${user.email}
    AND expires >= NOW()
`;

  const row = rows[0] as PendingInviteCountRow | undefined;

  return (row?.count ?? 0) > 0;
}
