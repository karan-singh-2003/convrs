import { neon } from "@neondatabase/serverless";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
// @ts-ignore - Prisma Client is generated at build time
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const sql = neon(connectionString);
// @ts-ignore - Second parameter is optional in some versions
const adapter = new PrismaNeonHttp(sql, { connectionString });

// @ts-ignore
export const prismaEdge = new PrismaClient({ adapter });
