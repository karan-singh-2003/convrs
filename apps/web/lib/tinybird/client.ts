import { Tinybird } from "@chronark/zod-bird";
console.log("Tinybird URL in client.ts:", process.env.TINYBIRDS_API_URL);
console.log("Tinybird Key in client.ts:", process.env.TINYBIRDS_API_KEY);
export const tb = new Tinybird({
  token: process.env.TINYBIRDS_API_KEY as string,
  baseUrl: process.env.TINYBIRDS_API_URL as string,
});