import { withWorkspace } from "@/lib/auth";
import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { getAnalytics } from "@/lib/analytics/get-analytics";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ searchParams, workspace, session }) => {
    //  Step 1: Parse & validate
    const parsedParams = analyticsQuerySchema.parse(searchParams);

    //  Step 5: Call getAnalytics with workspace context
    const data = await getAnalytics({
      ...parsedParams,
      workspaceId: workspace.id,
    });

    return NextResponse.json({ data });
  },

  { requiredPermission: "analytics.read" }
);
