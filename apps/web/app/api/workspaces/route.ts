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
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid request body",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ─────────────────────────────────────────────
  // Get authenticated user
  // ─────────────────────────────────────────────

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      freeTrialUsedAt: true,
    },
  });

  if (!user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const hasUsedTrial = !!user.freeTrialUsedAt;

    const trialUsageLimit = 10_000;

    const now = new Date();

    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const workspace = await prisma.$transaction(
      async (tx) => {
        // ───────────────────────────────────────
        // User eligible for free trial
        // ───────────────────────────────────────

        if (!hasUsedTrial) {
          // Mark trial as consumed globally
          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              freeTrialUsedAt: now,
            },
          });

          return tx.workspace.create({
            data: {
              name,
              slug,
              domain,

              // Billing
              subscriptionStatus: "trialing",
              billingInterval: "month",

              currentPeriodStart: now,
              currentPeriodEnd: trialEndDate,
              freeTrialEndDate: trialEndDate,

              // Limits
              tierEvents: trialUsageLimit,
              usageLimit: trialUsageLimit,

              // Tokens
              projectToken: nanoid(32),
              inviteCode: nanoid(24),

              // Owner
              users: {
                create: {
                  userId: session.user.id,
                  role: "owner",
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
          });
        }

        // ───────────────────────────────────────
        // Trial already consumed
        // ───────────────────────────────────────

        return tx.workspace.create({
          data: {
            name,
            slug,
            domain,

            // Billing
            subscriptionStatus: "inactive",

            // Limits
            tierEvents: 0,
            usageLimit: 0,

            // Tokens
            projectToken: nanoid(32),
            inviteCode: nanoid(24),

            // Owner
            users: {
              create: {
                userId: session.user.id,
                role: "owner",
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
        JSON.stringify({
          error: "Workspace slug is already taken",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.error("[workspace/create]", error);

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
