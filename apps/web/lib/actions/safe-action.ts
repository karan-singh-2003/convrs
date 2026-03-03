import { createSafeActionClient } from "next-safe-action";
import { getSession } from "../auth";
import { prisma } from "@repo/db";
import { normalizeWorkspaceId } from "../api/workspaces/workspace-id";

export const actionClient = createSafeActionClient({
  handleServerError: async (e) => {
    console.error("Action error:", e.message);

    if (e instanceof Error) {
      return e.message;
    }

    return "An unexpected error occurred.";
  },
});

export const authUserActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  return next({
    ctx: {
      user: session.user,
    },
  });
});

export const authActionClient = actionClient.use(
  async ({ next, clientInput }) => {
    const session = await getSession();
    if (!session) {
      throw new Error("Unauthorized: Login required.");
    }

    let workspaceId = (clientInput as { workspaceId?: string })?.workspaceId;

    if (!workspaceId) {
      throw new Error("Workspace ID is required.");
    }

    workspaceId = normalizeWorkspaceId(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: {
          where: { userId: session.user.id },
          select: {
            role: true,
            workspacePreferences: true,
          },
        },
      },
    });

    return next({
      ctx: {
        user: session.user,
        workspace: {
          ...workspace,
          role: workspace?.users[0]?.role,
        },
      },
    });
  }
);
