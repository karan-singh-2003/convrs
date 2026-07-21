// app/api/workspaces/[idOrSlug]/export/route.ts
import { withWorkspace } from "@/lib/auth";
import { exportWorkspaceData } from "@repo/analytics";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // seconds — large workspaces can take a while to page through

export const GET = withWorkspace(
    async ({ req, workspace }) => {
        const { searchParams } = new URL(req.url);
        const start = searchParams.get("start") ?? undefined; // e.g. "2025-01-01"
        const end = searchParams.get("end") ?? undefined; // e.g. "2026-07-10"

        const { buffer, rowCount } = await exportWorkspaceData({
            workspaceId: workspace.id,
            start,
            end,
        });

        if (rowCount === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No events found for this workspace in the given range",
                },
                { status: 404 }
            );
        }

        const filename = `convrs-export-${workspace.slug}-${new Date()
            .toISOString()
            .slice(0, 10)}.zip`;

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": buffer.length.toString(),
            },
        });
    },
    { requiredPermission: "workspace:read" }
);