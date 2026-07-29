// app/api/workspace/[id]/proxy-domain/verify/route.ts
import { getDomainResponse } from "@/lib/domains/get-domain-response";
import { getConfigResponse } from "@/lib/domains/get-config-response";
import { verifyDomain } from "@/lib/domains/verify-domain";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { Prisma } from "@repo/db/client";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace }) => {
    const domain = await prisma.workspaceDomain.findFirst({ where: { workspaceId: workspace.id } });
    if (!domain) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [domainJson, configJson] = await Promise.all([
      getDomainResponse(domain.subdomain),
      getConfigResponse(domain.subdomain),
    ]);

    let status: "pending" | "active" | "error" = "pending";
    let verification: Prisma.InputJsonValue | Prisma.JsonNullValueInput = domain.verification
      ? (JSON.parse(JSON.stringify(domain.verification)) as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    if (!domainJson.verified) {
      const verificationJson = await verifyDomain(domain.subdomain);
      if (verificationJson?.verified) {
        status = "active";
        verification = Prisma.JsonNull;
      } else if (verificationJson?.verification) {
        verification = JSON.parse(JSON.stringify(verificationJson.verification)) as Prisma.InputJsonValue;
      }
    } else if (!configJson.misconfigured) {
      status = "active";
    }

    const updated = await prisma.workspaceDomain.update({
      where: { id: domain.id },
      data: {
        status,
        verification,
        lastCheckedAt: new Date(),
        activatedAt: status === "active" ? (domain.activatedAt ?? new Date()) : domain.activatedAt,
      },
    });

    return NextResponse.json(updated);
  },
  { requiredPermission: "workspace:read" },
);