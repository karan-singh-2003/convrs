import { Tinybird } from "@chronark/zod-bird";

export const tb = new Tinybird({
  token: process.env.TINYBIRDS_API_KEY as string,
  baseUrl: process.env.TINYBIRDS_API_URL as string,
});