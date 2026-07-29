// import { prisma } from "@repo/db";
// import { getApexDomain } from "@repo/utils";

// export const removeDomainFromVercel = async (domain: string) => {
//   const apexDomain = getApexDomain(`https://${domain}`);
//   const domains = await prisma.domain.findMany({
//     where: {
//       OR: [
//         {
//           domain: apexDomain,
//         },
//         {
//           domain: {
//             endsWith: `.${apexDomain}`,
//           },
//         },
//       ],
//     },
//     select: {
//       domain: true,
//     },
//   });
//   // if there are other subdomains or the apex domain itself is in use
//   // so we should only remove it from our Vercel project
//   if (domains.filter((d) => d.domain !== domain).length > 0) {
//     return await fetch(
//       `https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain.toLowerCase()}?teamId=${process.env.TEAM_ID_VERCEL}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.VERCEL_API_KEY}`,
//         },
//         method: "DELETE",
//       },
//     ).then((res) => res.json());
//   } else {
//     // if this is the only domain that is in use
//     // we can remove it entirely from our Vercel team
//     return await fetch(
//       `https://api.vercel.com/v6/domains/${domain.toLowerCase()}?teamId=${process.env.TEAM_ID_VERCEL}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.VERCEL_API_KEY}`,
//         },
//         method: "DELETE",
//       },
//     ).then((res) => res.json());
//   }
// };

// lib/api/domains/remove-domain-from-vercel.ts


import { prisma } from "@repo/db";
import { getApexDomain } from "@repo/utils";

export const removeDomainFromVercel = async (subdomain: string) => {
  const apexDomain = getApexDomain(`https://${subdomain}`);

  const domains = await prisma.workspaceDomain.findMany({
    where: {
      OR: [
        { subdomain: apexDomain },
        { subdomain: { endsWith: `.${apexDomain}` } },
      ],
    },
    select: { subdomain: true },
  });

  if (domains.filter((d) => d.subdomain !== subdomain).length > 0) {
    return await fetch(
      `https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${subdomain.toLowerCase()}?teamId=${process.env.TEAM_ID_VERCEL}`,
      { headers: { Authorization: `Bearer ${process.env.VERCEL_API_KEY}` }, method: "DELETE" },
    ).then((res) => res.json());
  }

  return await fetch(
    `https://api.vercel.com/v6/domains/${subdomain.toLowerCase()}?teamId=${process.env.TEAM_ID_VERCEL}`,
    { headers: { Authorization: `Bearer ${process.env.VERCEL_API_KEY}` }, method: "DELETE" },
  ).then((res) => res.json());
};