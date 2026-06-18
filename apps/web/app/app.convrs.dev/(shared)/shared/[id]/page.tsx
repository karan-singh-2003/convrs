// app/shared/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import Analytics from "@/ui/analytics"; // adjust path
import { Button } from "@repo/ui";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SharedAnalyticsPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  //  Fetch workspace using publicId
  const workspace = await prisma.workspace.findUnique({
    where: {
      publicId: id,
    },
    select: {
      id: true,
      name: true,
      isPublic: true,
      publicId: true,
    },
  });

  //  Block access
  if (!workspace || !workspace.isPublic) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-x-0 top-0 z-50  bg-white/90 py-2 backdrop-blur-sm">
        <nav className="mx-auto flex w-full max-w-screen-lg items-center justify-between gap-4 px-4 md:px-0">
          <div className="flex items-center gap-2.5 font-display text-sm font-medium text-neutral-600">
            <h1 className="font-semibold font-poppins px-1 text-[14.5px]">
                {workspace.name}
            </h1>
            {/* <h1 className="text-[13px] font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
              {workspace.name}{" "}
            </h1> */}
          </div>
          <Button
            text="Get Started"
            className="w-fit ml-2 rounded-full text-[13px] font-poppins h-fit py-1.5"
          />
        </nav>
      </div>

      {/* Analytics (read-only mode) */}

      <div className="pt-24 ">
        <Analytics mode="public" workspaceId={workspace.id} />
      </div>
    </div>
  );
}
