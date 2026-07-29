// // app/api/workspace/[id]/proxy-domain/route.ts
// import { addDomainToVercel } from "@/lib/domains/add-domain-to-vercel";
// import { isValidDomain } from "@/lib/domains/is-valid-domain";
// import { withWorkspace } from "@/lib/auth";
// import { prisma } from "@repo/db";
// import { NextResponse } from "next/server";

// export const POST = withWorkspace(
//   async ({ req, workspace }) => {
//     const { subdomain } = await req.json();

//     if (!subdomain || !isValidDomain(subdomain)) {
//       return NextResponse.json({ error: "Enter a valid subdomain, e.g. a.yoursite.com" }, { status: 400 });
//     }

//     const existing = await prisma.workspaceDomain.findUnique({ where: { subdomain } });
//     if (existing) {
//       return NextResponse.json({ error: "This subdomain is already in use." }, { status: 409 });
//     }

//     const vercelResponse = await addDomainToVercel(subdomain);
//     if (vercelResponse.error && vercelResponse.error.code !== "domain_already_in_use") {
//       return NextResponse.json({ error: vercelResponse.error.message }, { status: 422 });
//     }

//     const record = await prisma.workspaceDomain.create({
//       data: {
//         workspaceId: workspace.id,
//         subdomain,
//         status: "pending",
//         verification: vercelResponse.verification ?? null,
//       },
//     });

//     return NextResponse.json(record, { status: 201 });
//   },
//   { requiredPermission: "workspace:write" },
// );

// export const DELETE = withWorkspace(
//   async ({ req, workspace }) => {
//     const { subdomain } = await req.json();
//     const { removeDomainFromVercel } = await import("@/lib/domains/remove-domain-from-vercel");
//     await removeDomainFromVercel(subdomain);
//     await prisma.workspaceDomain.deleteMany({ where: { workspaceId: workspace.id, subdomain } });
//     return NextResponse.json({ ok: true });
//   },
//   { requiredPermission: "workspace:write" },
// );
// app/api/workspace/[id]/proxy-domain/route.ts
import { addDomainToVercel } from "@/lib/domains/add-domain-to-vercel";
import { isValidDomain } from "@/lib/domains/is-valid-domain";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { Prisma } from "@repo/db/client";
import { NextResponse } from "next/server";

// app/api/workspace/[id]/proxy-domain/route.ts  (add this alongside POST/DELETE)
export const GET = withWorkspace(
  async ({ workspace }) => {
    const domain = await prisma.workspaceDomain.findFirst({
      where: { workspaceId: workspace.id },
    });
    return NextResponse.json(domain); // null if none exists yet
  },
  { requiredPermission: "workspace:read" },
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const { subdomain } = await req.json();

    if (!subdomain || !isValidDomain(subdomain)) {
      return NextResponse.json({ error: "Enter a valid subdomain, e.g. a.yoursite.com" }, { status: 400 });
    }

    const existing = await prisma.workspaceDomain.findUnique({ where: { subdomain } });
    if (existing) {
      return NextResponse.json({ error: "This subdomain is already in use." }, { status: 409 });
    }

    const vercelResponse = await addDomainToVercel(subdomain);
    if (vercelResponse.error && vercelResponse.error.code !== "domain_already_in_use") {
      return NextResponse.json({ error: vercelResponse.error.message }, { status: 422 });
    }

    const verificationJson: Prisma.InputJsonValue | Prisma.JsonNullValueInput = vercelResponse.verification
      ? (JSON.parse(JSON.stringify(vercelResponse.verification)) as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    const record = await prisma.workspaceDomain.create({
      data: {
        workspaceId: workspace.id,
        subdomain,
        status: "pending",
        verification: verificationJson,
      },
    });

    return NextResponse.json(record, { status: 201 });
  },
  { requiredPermission: "workspace:write" },
);

export const DELETE = withWorkspace(
  async ({ req, workspace }) => {
    const { subdomain } = await req.json();
    const { removeDomainFromVercel } = await import("@/lib/domains/remove-domain-from-vercel");
    await removeDomainFromVercel(subdomain);
    await prisma.workspaceDomain.deleteMany({ where: { workspaceId: workspace.id, subdomain } });
    return NextResponse.json({ ok: true });
  },
  { requiredPermission: "workspace:write" },
);