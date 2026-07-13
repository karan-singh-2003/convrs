import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export const APP_DOMAIN_WITH_NGROK =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_NGROK_URL
    ? process.env.NEXT_PUBLIC_NGROK_URL
    : process.env.NEXT_PUBLIC_APP_DOMAIN || "https://app.convrs.dev";