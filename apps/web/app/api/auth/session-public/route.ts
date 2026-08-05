// app.convrs.dev — app/api/auth/session-public/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@repo/db";
import ProjectToken from "@/ui/workspaces/copy-project-token";

// Optional defense-in-depth: only app2's server should call this.
// Not a security boundary on its own (anyone with the cookie already
// has a session), but keeps casual/browser hits out.
const INTERNAL_TOKEN = process.env.DOCS_SITE_INTERNAL_TOKEN;

export async function GET(req: Request) {
    if (INTERNAL_TOKEN) {
        const header = req.headers.get("x-internal-token");
        if (header !== INTERNAL_TOKEN) {
            return NextResponse.json({ user: null }, { status: 401 });
        }
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ user: null });
    }

    const memberships = await prisma.workspaceUsers.findMany({
        where: { userId: session.user.id },
        select: {
            role: true,
            workspace: { select: { id: true, name: true, slug: true, logo: true, projectToken: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
        user: {
            email: session.user.email,
            name: session.user.name,
            image: session.user.image ?? null,
        },
        defaultWorkspaceSlug: memberships[0]?.workspace.slug ?? null,
        workspaces: memberships.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            slug: m.workspace.slug,
            logo: m.workspace.logo,
            role: m.role,
            ProjectToken: m.workspace.projectToken
        })),
    });
}