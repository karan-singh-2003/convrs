// app/api/workspace/[id]/allowed-domains/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace }) => {
    const w = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { allowedHostnames: true, allowAllDomains: true },
    });
    return NextResponse.json(w);
  },
  { requiredPermission: "workspace:read" },
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const { domain } = await req.json();
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

    const w = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { allowedHostnames: true },
    });
    if (w?.allowedHostnames.includes(clean)) {
      return NextResponse.json({ error: "Domain already added." }, { status: 409 });
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { allowedHostnames: { push: clean } },
      select: { allowedHostnames: true, allowAllDomains: true },
    });
    return NextResponse.json(updated);
  },
  { requiredPermission: "workspace:write" },
);

export const DELETE = withWorkspace(
  async ({ req, workspace }) => {
    const { domain } = await req.json();
    const w = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { allowedHostnames: true },
    });
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { allowedHostnames: (w?.allowedHostnames ?? []).filter((d) => d !== domain) },
      select: { allowedHostnames: true, allowAllDomains: true },
    });
    return NextResponse.json(updated);
  },
  { requiredPermission: "workspace:write" },
);

export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { allowAllDomains } = await req.json();
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { allowAllDomains },
      select: { allowedHostnames: true, allowAllDomains: true },
    });
    return NextResponse.json(updated);
  },
  { requiredPermission: "workspace:write" },
);