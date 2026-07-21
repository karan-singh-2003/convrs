// app/app.convrs.dev/(shared)/shared/[id]/realtime/page.tsx

import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { Button } from "@repo/ui";
import RealtimeDashboard from "@/app/app.convrs.dev/(dashboard)/[slug]/(premium)/realtime/page";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SharedRealtimePage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  // Fetch workspace using publicId
  const workspace = await prisma.workspace.findUnique({
    where: {
      publicId: id,
    },
    select: {
      id: true,
      name: true,
      isPublic: true,
      projectToken: true,
    },
  });

  // Block access if workspace doesn't exist or isn't public
  if (!workspace || !workspace.isPublic) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-x-0 top-0 z-30 bg-white/90 py-2 backdrop-blur-sm">
        <nav className="mx-auto flex w-full max-w-screen-lg items-center justify-between gap-4 px-4 md:px-0">
          <div className="flex items-center gap-2.5 font-display text-sm font-medium text-neutral-600">
            <h1 className="font-semibold font-poppins px-1 text-[14.5px]">
              Convrs
            </h1>
          </div>
          <Button
            text="Get Started"
            className="w-fit ml-2 rounded-full text-[13px] font-poppins h-fit py-1.5"
          />
        </nav>
      </div>

      {/* Realtime dashboard (public mode — explicit props, no session) */}
      <div className="pt-12">
        <RealtimeDashboard
          workspaceId={workspace.id}
          projectToken={workspace.projectToken ?? undefined}
        />
      </div>
    </div>
  );
}
