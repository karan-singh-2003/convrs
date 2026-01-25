import { UserProps } from "@/lib/types";
import { prismaEdge } from "@repo/db/edge";
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

  const pendingInvites = await prismaEdge.workspaceInvite.count({
    where: {
      email: user.email,
      expires: {
        gte: new Date(),
      },
    },
  });

  return pendingInvites > 0;
}
