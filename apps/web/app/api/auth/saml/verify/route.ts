import { jackson } from "@/lib/jackson";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("🔍 Getting Jackson instance...");
    const { apiController } = await jackson();
    console.log("✅ Jackson instance retrieved");

    console.log("🔍 Parsing request body...");
    const { slug } = await req.json();
    console.log("✅ Slug:", slug);

    if (!slug) {
      return NextResponse.json(
        { error: "No workspace slug provided." },
        { status: 400 }
      );
    }

    console.log("🔍 Querying workspace...");
    const workspace = await prisma.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });
    console.log("✅ Workspace:", workspace);

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 }
      );
    }

    console.log("🔍 Getting SAML connections...");
    const connections = await apiController.getConnections({
      tenant: workspace.id,
      product: "Local Nextjs SAML Test",
    });
    console.log("✅ Connections:", connections);

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: "No SSO connections found for this workspace." },
        { status: 404 }
      );
    }

    const data = {
      workspaceId: workspace.id,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("❌ Error in /api/auth/saml/verify:");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error?.constructor?.name);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : "Unknown"
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
