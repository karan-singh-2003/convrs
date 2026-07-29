// lib/api/domains/utils.ts
import { prisma } from "@repo/db";
import { isValidDomain } from "./is-valid-domain";

export const validateDomain = async (
  subdomain: string,
): Promise<{ error: string | null; code?: string }> => {
  if (!subdomain || typeof subdomain !== "string") {
    return { error: "Missing subdomain", code: "unprocessable_entity" };
  }
  if (!isValidDomain(subdomain)) {
    return { error: "Invalid domain", code: "unprocessable_entity" };
  }
  const exists = await domainExists(subdomain);
  if (exists) {
    return { error: "This subdomain is already in use.", code: "conflict" };
  }
  return { error: null };
};

export const domainExists = async (subdomain: string) => {
  try {
    const response = await prisma.workspaceDomain.findFirst({
      where: { subdomain },
      select: { subdomain: true },
    });
    return !!response;
  } catch (err) {
    console.error("PRISMA ERROR", err);
    throw err;
  }
};

export interface VercelDomainVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface CustomResponse extends Response {
  json: () => Promise<any>;
  name?: string;
  verified?: boolean;
  verification?: VercelDomainVerification[];
  error?: { code: string; projectId: string; message: string };
}