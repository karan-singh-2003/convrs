import { UserProps } from "@/lib/types";
import { edgeDb } from "@repo/db/edge-raw";
import { NextRequest } from "next/server";

export async function hasPendingInvites({
  req,
  user,
}: {
  req: NextRequest;
  user: UserProps;
}) {
  console.log("Checking for pending invites for user:", user.email);
  if (
    req.nextUrl.searchParams.get("invite") ||
    req.nextUrl.pathname.startsWith("/invites/")
  ) {
    return true;
  }

  const pendingInvites = await edgeDb.countPendingInvites(user.email);

  return pendingInvites > 0;
}
