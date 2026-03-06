import { prisma } from "@repo/db";
import { APP_HOSTNAMES } from "@repo/utils";
import { headers } from "next/headers";
import { isGenericEmail } from "../../lib/is-generic-email"

// Checks if SAML SSO is enforced for a given email domain
export const isSamlEnforcedForEmailDomain = async (email: string) => {
  const hostname = (await headers()).get("host");
  const emailDomain = email.split("@")[1].toLocaleLowerCase();

  if (
    !hostname ||
    !emailDomain ||
    !APP_HOSTNAMES.has(hostname) ||
    isGenericEmail(email)
  ) {
    return false;
  }

  const workspace = await prisma.workspace.findUnique({
    where: {
      ssoEmailDomain: emailDomain,
    },
    select: {
      ssoEnforcedAt: true,
    },
  });

  if (workspace?.ssoEnforcedAt) {
    return true;
  }

  return false;
};