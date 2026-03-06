import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";
import { CloseInviteButton } from "./close-invite-button";
import { WorkspaceInvite, Workspace, User } from "@repo/db/client";
import { AcceptInviteButton } from "./accept-invite-button";
import { cn, OG_AVATAR_URL } from "@repo/utils";
import { InviteConfetti } from "./invite-confetti";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();

  if (!session) redirect(`/login?next=/${slug}/invite`);

  const [user, invite] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        _count: { select: { workspaceUsers: true } },
      },
    }),

    prisma.workspaceInvite.findFirst({
      where: {
        email: session.user.email,
        workspace: { slug },
      },
      include: {
        workspace: {
          select: {
            name: true,
            logo: true,
            users: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
  ]);

  if (!invite) redirect(`/${slug}`);

  if (invite.expires < new Date()) {
    return (
      <div className="min-h-screen flex flex-col items-center px-4 py-8">
        <PageLogo />

        <div className="w-full max-w-md mt-8">
          <Hero isExpired invite={invite} user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <PageLogo />

      <div className="w-full max-w-md flex justify-end mt-4">
        <CloseInviteButton goToOnboarding={user._count.workspaceUsers === 0} />
      </div>

      <div className="w-full max-w-md flex flex-col items-center mt-6">
        <Hero invite={invite} user={user} isExpired={false} />
      </div>

      <InviteConfetti />
    </div>
  );
}

function PageLogo() {
  return (
    <div className="flex justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 182 199"
        fill="none"
        className="size-8 sm:size-9"
      >
        <path
          d="M0 50.837L90.3333 0L182 50.837V148.832L90.3333 199L0 148.832V50.837Z"
          fill="#363636"
        />
        <path
          d="M10 50.0038L90.1639 5L173 49.6679L90.832 94L10 50.0038Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

function Hero({
  isExpired,
  invite,
  user,
}: {
  isExpired: boolean;
  invite: Pick<WorkspaceInvite, "role" | "expires"> & {
    workspace: Pick<Workspace, "logo" | "name">;
  };
  user: Pick<User, "id" | "name" | "image"> & {
    _count: { workspaceUsers: number };
  };
}) {
  return (
    <>
      {/* Avatars */}
      <div
        className={cn(
          "relative mt-6 flex items-center justify-center",
          "animate-slide-up-fade motion-reduce:animate-fade-in"
        )}
      >
        <img
          src={
            invite.workspace.logo || `${OG_AVATAR_URL}${invite.workspace.name}`
          }
          alt={invite.workspace.name}
          className="z-10 size-16 sm:size-20 rotate-[-12deg] rounded-full drop-shadow-md"
        />

        <img
          src={user?.image || `${OG_AVATAR_URL}${user?.id}`}
          alt={user?.name || "Your avatar"}
          className="-ml-4 size-16 sm:size-20 rotate-[12deg] rounded-full drop-shadow-md"
        />
      </div>

      {/* Text */}
      <div
        className={cn(
          "flex flex-col items-center text-center w-full mt-6",
          "animate-slide-up-fade motion-reduce:animate-fade-in",
          "max-w-md"
        )}
      >
        <h2 className="text-neutral-700 text-lg sm:text-xl font-semibold font-display">
          {!isExpired ? (
            <>Welcome to the {invite.workspace.name} workspace</>
          ) : (
            <>Your invite to the {invite.workspace.name} workspace has expired</>
          )}
        </h2>

        <p className="text-neutral-500 text-sm sm:text-[15px] font-display mt-1">
          {!isExpired ? (
            <>You've been added as a {invite.role}</>
          ) : (
            <>Please contact the owner to request another invite.</>
          )}
        </p>

        {/* Button */}
        <div className="mt-5 w-full flex justify-center">
          {!isExpired ? (
            <AcceptInviteButton />
          ) : (
            <CloseInviteButton
              goToOnboarding={user._count.workspaceUsers === 0}
              variant="full"
            />
          )}
        </div>
      </div>
    </>
  );
}