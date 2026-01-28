import { WorkspaceProps } from "../types";
import { WorkspaceRole } from "@repo/db/client";
import { getSession, Session } from "../auth/utils";
import { randomBytes } from "crypto";
import { prisma } from "@repo/db";
import { hashToken } from "../auth/hash-token";
import { sendEmail } from "@repo/email";
import WorkspaceInvite from "@repo/email/templates/workspace-invite";

const TWO_WEEKS_IN_SECONDS = 14 * 24 * 60 * 60;

export async function inviteUser({
  email,
  role,
  workspace,
  session,
}: {
  email: string;
  role: WorkspaceRole;
  workspace: WorkspaceProps;
  session: Session;
}) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TWO_WEEKS_IN_SECONDS * 1000);

  // create a workspace invite record and a verification request token that lasts for a week
  // here we use a try catch to account for the case where the user has already been invited
  // for which `prisma.projectInvite.create()` will throw a unique constraint error
  try {
    await prisma.workspaceInvite.create({
      data: {
        email,
        role,
        expires,
        workspaceId: workspace.id,
      },
    });
  } catch (error) {
    throw new Error("User has already been invited to the workspace");
  }

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: await hashToken(token, { secret: true }),
      expires,
    },
  });

  const params = new URLSearchParams({
    callbackUrl: `${process.env.NEXTAUTH_URL}/${workspace.slug}/invite`,
    email,
    token,
  });

  const url = `${process.env.NEXTAUTH_URL}/api/auth/callback/email?${params}`;

  return await sendEmail({
    subject: `You've been invited to join a workspace on ${process.env.NEXT_PUBLIC_APP_NAME}`,
    to: email,
    react: WorkspaceInvite({
      email,
      url,
      workspaceName: workspace.name,
      workspaceUser: session?.user.name || null,
      workspaceUserEmail: session?.user.email || null,
    }),
  });
}
