import { PrismaNeon } from "@prisma/adapter-neon";
// @ts-ignore - Prisma Client is generated at build time
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });

// @ts-ignore
export const prismaEdge = new PrismaClient({ adapter });
