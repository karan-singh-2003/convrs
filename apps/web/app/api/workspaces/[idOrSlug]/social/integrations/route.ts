// // FILE: app/api/workspaces/[idOrSlug]/social/integrations/route.ts

// import { withWorkspace } from "@/lib/auth";
// import { prisma } from "@repo/db";

// export const GET = withWorkspace(
//   async ({ workspace }) => {
//     const integrations = await prisma.socialIntegration.findMany({
//       where: { workspaceId: workspace.id, status: "active" },
//       select: { platform: true },
//     });

//     const connectedPlatforms = new Set(integrations.map((i) => i.platform));

//     return new Response(
//       JSON.stringify({
//         data: {
//           x: connectedPlatforms.has("x"),
//           reddit: connectedPlatforms.has("reddit"),
//         },
//       }),
//       { status: 200, headers: { "Content-Type": "application/json" } }
//     );
//   },
//   { requiredPermission: "analytics.read" }
// );


// FILE: app/api/workspaces/[idOrSlug]/social/integrations/route.ts

import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";

export const GET = withWorkspace(
  async ({ workspace }) => {
    const handles = await prisma.socialAttributionHandle.findMany({
      where: { workspaceId: workspace.id },
      select: { platform: true },
    });

    const connectedPlatforms = new Set(handles.map((h) => h.platform));

    return new Response(
      JSON.stringify({
        data: {
          x: connectedPlatforms.has("x"),
          reddit: connectedPlatforms.has("reddit"),
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  },
  {
    requiredPermission: "analytics.read",
  }
);