import { withSession } from "@/lib/auth/session";
import {
  createWorkspaceSchema,
  WorkspaceSchema,
} from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { checkIfUserExists } from "@/lib/actions/auth/check-if-user-exists";
import { nanoid, Starter_Plan } from "@repo/utils";
import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { Prisma } from "@repo/db/client";
import { z } from "zod";

// GET /api/workspaces - get all workspaces for the authenticated user
export const GET = withSession(async ({ session }) => {
  const workspaces = await prisma.workspace.findMany({
    where: {
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      users: {
        where: {
          userId: session.user.id,
        },
        select: {
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(
    workspaces.map((workspace) =>
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      })
    )
  );
});

// POST /api/workspaces - create a new workspace
export const POST = withSession(async ({ req, session }) => {
  let name: string;
  let slug: string;
  let domain: string;

  try {
    ({ name, slug, domain } = await createWorkspaceSchema.parseAsync(
      await req.json()
    ));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: error.issues[0]?.message || "Invalid workspace payload",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userExists = await checkIfUserExists(session.user.id);

  if (!userExists) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const starterPlanEvents = Starter_Plan?.limits.events ?? 10_000;
    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const workspace = await prisma.$transaction(
      async (tx) => {
        return tx.workspace.create({
          data: {
            name,
            slug,
            domain,
            plan: "starter",
            billingInterval: "month",
            subscriptionStatus: "trialing",
            freeTrialEndDate: trialEndDate,
            tierEvents: starterPlanEvents,
            usageLimit: starterPlanEvents,
            projectToken: nanoid(32),
            users: {
              create: {
                userId: session.user.id,
                role: "owner",
              },
            },
            inviteCode: nanoid(24),
          },
          include: {
            users: {
              where: {
                userId: session.user.id,
              },
              select: {
                role: true,
              },
            },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 5000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json(
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      })
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new Response(
        JSON.stringify({ error: "Workspace slug is already taken" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
