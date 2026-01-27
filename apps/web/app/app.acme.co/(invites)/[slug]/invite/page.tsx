import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";
import { CloseInviteButton } from "./close-invite-button";
import { WorkspaceInvite, Workspace, User } from "@prisma/client";
import { AcceptInviteButton } from "./accept-invite-button";
import { cn, OG_AVATAR_URL } from "@repo/utils";
import { InviteConfetti } from "./invite-confetti";

const MAX_TEAM_DISPLAY = 4;

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
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        _count: {
          select: {
            workspaceUsers: true,
          },
        },
      },
    }),

    prisma.workspaceInvite.findFirst({
      where: {
        email: session.user.email,
        workspace: {
          slug,
        },
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
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    }),
  ]);

  if (!invite) {
    redirect(`/${slug}`);
  }
  if (invite.expires < new Date()) {
    return (
      <>
        <div>
          <CloseInviteButton
            goToOnboarding={user._count.workspaceUsers === 0}
          />
          <div>
            <Hero isExpired invite={invite} user={user}></Hero>
          </div>
        </div>
      </>
    );
  }

  console.log("Rendering invite page for workspace:", invite.role);
  return (
    <div>
      <div className="flex items-center justify-end p-4">
        <CloseInviteButton goToOnboarding={user._count.workspaceUsers === 0} />
      </div>
      <div className="flex w-full flex-col items-center justify-center px-4 py-10">
        <Hero invite={invite} user={user} isExpired={false} />
      </div>
      <InviteConfetti />
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
      <div
        className={cn(
          "relative z-0 mt-8 flex items-center",
          "animate-slide-up-fade motion-reduce:animate-fade-in [--offset:10px] [animation-delay:50ms] [animation-duration:0.5s] [animation-fill-mode:both]"
        )}
      >
        <img
          src={
            invite.workspace.logo || `${OG_AVATAR_URL}${invite.workspace.name}`
          }
          alt={invite.workspace.name}
          className="z-10 size-20 rotate-[-15deg] rounded-full drop-shadow-md"
        />
        <img
          src={user?.image || `${OG_AVATAR_URL}${user?.id}`}
          alt={user?.name || "Your avatar"}
          className="-ml-4 size-20 rotate-[15deg] rounded-full drop-shadow-md"
        />
        {/* <div className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white p-0.5">
          {isExpired ? (
            <div className="rounded-full bg-neutral-200 p-1">
              <CircleHalfDottedClock className="size-5 text-neutral-500" />
            </div>
          ) : (
            <CircleCheckFill className="size-8 text-green-500" />
          )}
        </div> */}
      </div>

      <div
        className={cn(
          "flex w-full flex-col items-center text-center",
          "animate-slide-up-fade motion-reduce:animate-fade-in [--offset:10px] [animation-delay:100ms] [animation-duration:0.5s] [animation-fill-mode:both]",
          !isExpired ? "max-w-[400px]" : "max-w-[440px]"
        )}
      >
        <h2 className="text-content-default mt-4 text-pretty text-lg font-semibold">
          {!isExpired ? (
            <>Welcome to the {invite.workspace.name} workspace</>
          ) : (
            <>
              Your invite to the {invite.workspace.name} workspace has expired
            </>
          )}
        </h2>
        <p className="text-content-subtle text-pretty text-base font-medium">
          {!isExpired ? (
            <>
              You've been added as a {invite.role}{" "}
              {/* <Tooltip
                content={
                  invite.role === "owner"
                    ? "You have the highest workspace permissions. [Learn more](https://dub.co/help/article/workspace-roles#member-role)"
                    : "You have limited workspace permissions. [Learn more](https://dub.co/help/article/workspace-roles#member-role)"
                }
              >
                <span className="underline decoration-dotted underline-offset-2">
                  {invite.role === "billing" ? "billing user" : invite.role}
                </span>
              </Tooltip> */}
            </>
          ) : (
            <>Please contact the owner to request another invite.</>
          )}
        </p>

        <div className="mt-4 flex w-full justify-center">
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
