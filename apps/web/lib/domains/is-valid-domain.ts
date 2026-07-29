import { validDomainRegex } from "@repo/utils";

const RESERVED_DOMAINS = /^(convrs\.dev|.*\.convrs\.dev)$/i;

export const isValidDomain = (domain: string) => {
  return (
    validDomainRegex.test(domain) &&
    !RESERVED_DOMAINS.test(domain)
  );
};

export const isValidDomainFormat = (domain: string) => {
  return validDomainRegex.test(domain);
};

export const isValidDomainFormatWithLocalhost = (domain: string) => {
  const d = domain.trim().toLowerCase();
  return validDomainRegex.test(d) || /^localhost(?::\d{1,5})?$/.test(d);
};