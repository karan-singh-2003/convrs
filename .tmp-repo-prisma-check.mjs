import { prisma } from "@repo/db";
console.log("modelKeys", Object.keys(prisma).filter((k) => !k.startsWith("$")).slice(0, 120));
console.log("hasAlert", Boolean(prisma.alert));
await prisma.$disconnect();
