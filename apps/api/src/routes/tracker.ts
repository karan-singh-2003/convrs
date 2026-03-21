import fs from "fs";
import path from "path";
import { FastifyInstance } from "fastify";

export async function trackerRoute(fastify: FastifyInstance) {
  fastify.get("/analytics.js", async (_req, reply) => {
    console.log("Serving tracker script");
    const filePath = path.join(
      process.cwd(),
      "../../packages/tracker/dist/analytics.global.js"
    );

    const code = fs.readFileSync(filePath, "utf8");

    reply.type("application/javascript").send(code);
  });
}