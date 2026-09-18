import { withSession } from "@/lib/auth/session";
import {
  createWorkspaceSchema,
  WorkspaceSchema,
} from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { nanoid } from "@repo/utils";
import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { Prisma } from "@repo/db/client";
import { z } from "zod";
import { grantAutoTrialForNewWorkspace } from "@/lib/billing/auto-trial";

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
  let timezone: string | undefined;

  try {
    ({ name, slug, domain, timezone } = await createWorkspaceSchema.parseAsync(
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

  try {
    // Prefer the timezone the client picked during onboarding; fall back to
    // server-side detection for callers that don't send one.
    const detectedTimezone =
      timezone || Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Kolkata"

    let workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        domain,

        // Billing
        subscriptionStatus: "inactive",
        plan: "free",
        billingInterval: "month",

        // Limits
        tierEvents: 0,
        usageLimit: 0,
        //  timezone
        timezone: detectedTimezone,
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

    // Automatic 14-day cardless trial (lib/billing/auto-trial.ts): runs only
    // after the workspace row above already exists, so a failure here can
    // never prevent workspace creation. Best-effort — eligibility failures
    // and race losers (Serializable conflicts) are expected outcomes, not
    // errors, and are swallowed; only re-fetch the workspace when a trial
    // was actually granted, so the response reflects the fanned-out billing
    // fields (subscriptionStatus/freeTrialEndDate/etc.) without the caller
    // having to make a second request.
    try {
      const trialResult = await grantAutoTrialForNewWorkspace({
        userId: session.user.id,
        workspaceId: workspace.id,
      });

      if (trialResult.granted) {
        const refreshed = await prisma.workspace.findUnique({
          where: { id: workspace.id },
          include: {
            users: {
              where: { userId: session.user.id },
              select: { role: true },
            },
          },
        });
        if (refreshed) workspace = refreshed;
      }
    } catch (trialError) {
      console.error("[workspace/create] auto-trial grant failed", trialError);
    }

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
