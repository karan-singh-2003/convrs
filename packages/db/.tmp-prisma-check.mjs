import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
console.log("modelKeys", Object.keys(p).filter((k) => !k.startsWith("$")).slice(0, 120));
console.log("hasAlert", Boolean(p.alert));
await p.$disconnect();
