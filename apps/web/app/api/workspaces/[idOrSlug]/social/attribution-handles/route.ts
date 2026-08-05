// // FILE: app/api/[slug]/social/attribution-handles/route.ts
// import { withWorkspace } from "@/lib/auth";
// import { prisma } from "@repo/db";
// import { z } from "zod";

// const createHandleSchema = z.object({
//   handle: z.string().min(1),
//   platform: z.enum(["x", "reddit"]).default("x"),
// });

// export const GET = withWorkspace(
//   async ({ workspace }) => {
//     const handles = await prisma.socialAttributionHandle.findMany({
//       where: { workspaceId: workspace.id },
//       orderBy: { createdAt: "desc" },
//     });

//     return new Response(JSON.stringify({ data: handles }), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   },
//   { requiredPermission: "analytics.read" }
// );

// export const POST = withWorkspace(
//   async ({ req, workspace }) => {
//     const body = await req.json();
//     const { handle: rawHandle, platform } = createHandleSchema.parse(body);
//     const handle = rawHandle.replace(/^@/, "").toLowerCase();

//     const created = await prisma.socialAttributionHandle.upsert({
//       where: {
//         workspaceId_platform_handle: { workspaceId: workspace.id, platform, handle },
//       },
//       update: {},
//       create: { workspaceId: workspace.id, platform, handle },
//     });

//     return new Response(JSON.stringify({ data: created }), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });
//   },
//   { requiredPermission: "workspace:write" }
// );


// ------------------------------------------------------------------------
// -------------------------------version 2--------------------------------
// ------------------------------------------------------------------------


// FILE: app/api/[slug]/social/attribution-handles/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { z } from "zod";
import { workspaceHasSocialAttribution, upgradeRequiredResponse } from "@/lib/billing/entitlement";

const createHandleSchema = z.object({
  handle: z.string().min(1),
  platform: z.enum(["x", "reddit"]).default("x"),
});

export const GET = withWorkspace(
  async ({ workspace }) => {
    const handles = await prisma.socialAttributionHandle.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ data: handles }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "analytics.read" }
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    if (!workspaceHasSocialAttribution(workspace)) {
      return upgradeRequiredResponse(
        "Link attribution requires the Growth plan."
      );
    }

    const body = await req.json();
    const { handle: rawHandle, platform } = createHandleSchema.parse(body);
    const handle = rawHandle.replace(/^@/, "").toLowerCase();

    const created = await prisma.socialAttributionHandle.upsert({
      where: {
        workspaceId_platform_handle: { workspaceId: workspace.id, platform, handle },
      },
      update: {},
      create: { workspaceId: workspace.id, platform, handle },
    });

    return new Response(JSON.stringify({ data: created }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);