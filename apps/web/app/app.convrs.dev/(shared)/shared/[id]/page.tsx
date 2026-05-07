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
    <div className="min-h-screen ">
      {/* Header (simple public view) */}
      <div className="">
        <div className=" flex justify-between items-center max-w-5xl mx-auto bg-white px-2 py-3">
          <h1 className="text-sm font-medium font-display text-neutral-700">
            {/* {workspace.name} Analytics */}
            Convrs
          </h1>
          <Button
            text="Get Started"
            className="w-fit rounded-full text-[13px] font-poppins h-fit py-1.5"
          />
        </div>
      </div>

      {/* Analytics (read-only mode) */}
      <div className="mx-auto w-full  px-4 py-4">
        <Analytics mode="public" workspaceId={workspace.id} />
      </div>
    </div>
  );
}
