import { getSession, hashToken } from "@/lib/auth";
import { redis } from "@/lib/upstash";
import { sendEmail } from "@repo/email";
import EmailUpdated from "@repo/email/templates/email-updated";
import { prisma } from "@repo/db";
import { User, VerificationToken } from "@repo/db/client";
import { LoadingSpinner } from "@repo/ui";
import { waitUntil } from "@vercel/functions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ConfirmEmailChangePageClient from "./page-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancel?: string }>;
}

export default async function ConfirmEmailChangePage(props: PageProps) {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyEmailChange {...props} />
    </Suspense>
  );
}

const VerifyEmailChange = async ({ params, searchParams }: PageProps) => {
  const { token } = await params;

  const tokenFound = await prisma.verificationToken.findUnique({
    where: {
      token: await hashToken(token, { secret: true }),
    },
  });

  if (!tokenFound || tokenFound.expires < new Date()) {
    return (
      <MessageState
        title="Invalid or Expired Token"
        description="This email change token is invalid or has expired. Please request a new email change."
      />
    );
  }

  const { cancel } = await searchParams;

  if (cancel === "true") {
    await deleteRequest(tokenFound);

    return (
      <MessageState
        title="Email Change Request Canceled"
        description="Your email change request has been canceled. No changes have been made to your account."
      />
    );
  }

  const session = await getSession();

  if (!session) {
    redirect(`/login?next=/auth/confirm-email-change/${token}`);
  }

  const { id: userId } = session.user;

  const data = await redis.get<{
    email: string;
    newEmail: string;
  }>(`email-change-request:user:${userId}`);

  if (!data) {
    return (
      <MessageState
        title="Invalid Token"
        description="This token is invalid. Please request a new one."
      />
    );
  }

  let user: User | null = null;

  user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      email: data.newEmail,
    },
  });

  waitUntil(
    Promise.allSettled([
      deleteRequest(tokenFound),
      sendEmail({
        subject: "Your email address has been changed",
        to: data.email,
        react: EmailUpdated({
          oldEmail: data.email,
          newEmail: data.newEmail,
        }),
      }),
    ])
  );

  return <ConfirmEmailChangePageClient />;
};

const LoadingState = () => {
  return (
    <div className="max-w-sm mx-auto px-4 md:px-0 py-20 text-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner className="size-6 animate-spin" />

        <h1 className="text-[20px] font-display font-semibold">
          Verifying Email Change
        </h1>

        <p className="text-muted-foreground text-[15px] font-display">
          Verifying your email change request. This may take a few seconds.
        </p>
      </div>
    </div>
  );
};

const MessageState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <div className="max-w-sm mx-auto px-4 md:px-0 py-20 text-center">
      <div className="flex flex-col items-center gap-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 182 199"
          fill="none"
          className="size-8"
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

        <h1 className="text-[20px] font-display font-semibold">{title}</h1>

        <p className="text-muted-foreground text-[15px] font-display">
          {description}
        </p>
      </div>
    </div>
  );
};

const deleteRequest = async (tokenFound: VerificationToken) => {
  await Promise.allSettled([
    prisma.verificationToken.delete({
      where: {
        token: tokenFound.token,
      },
    }),

    redis.del(`email-change-request:user:${tokenFound.identifier}`),
  ]);
};