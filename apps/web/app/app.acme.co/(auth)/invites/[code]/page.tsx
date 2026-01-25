import { Suspense } from "react";
import { prisma } from "@repo/db";
import { getSession } from "@/lib/auth/utils";
import { redirect } from "next/dist/client/components/navigation";
import { onboardingStepCache } from "@/lib/api/workspaces/onboarding-step-cache";
import EmptyState from "@/ui/shared/empty-state";
import { LinkBroken, Users6 } from "@repo/ui/index"

export default async function InvitePage(props: {
  params: {
    code: string;
  };
}) {
  const params = await props.params;
  return (
    <div>
      <Suspense>
        <VerifyInvite code={params.code} />
      </Suspense>
    </div>
  );
}

async function VerifyInvite({ code }: { code: string }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const workspace = await prisma.workspace.findUnique({
    where: {
      inviteCode: code,
    },
    select: {
      id: true,
      slug: true,
      users: {
        where: {
          userId: session.user.id,
        },
        select: {
          role: true,
        },
      },
      _count: {
        select: {
          users: {
            where: {
              user: {
              },
            },
          },
        },
      },
    },
  });

  if (!workspace) {
    return (
      <EmptyState
        icon={LinkBroken}
        title="Invalid Invite Link"
        description="The invite link you are trying to use is invalid. Please contact the workspace owner for more information."
      />
    );
  }

  // check if user is already in the workspace
  if (workspace.users.length > 0) {
    redirect(`/${workspace.slug}`);
  }

//   if (workspace._count.users >= workspace.userLimit) {
//     return (
//       <EmptyState
//         icon={Users6}
//         title="User Limit Reached"
//         description="The workspace you are trying to join is currently full. Please contact the workspace owner for more information."
//       />
//     );
//   }

  await prisma.workspaceUsers.create({
    data: {
      userId: session.user.id,
      workspaceId: workspace.id,
    },
  });

  // Update default workspace
  if (!session.user.defaultWorkspace) {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        defaultWorkspace: workspace.slug,
      },
    });
  }

  // Complete onboarding just in case
  await onboardingStepCache.set({
    userId: session.user.id,
    step: "completed",
  });

  redirect(`/${workspace.slug}`);
}