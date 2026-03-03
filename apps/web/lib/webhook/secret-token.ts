import { randomBytes } from "crypto";
import { WEBHOOK_SECRET_PREFIX, WEBHOOK_SECRET_TOKEN_LENGTH } from "./constant";

export const createWebhookSecretToken = () => {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_TOKEN_LENGTH).toString("hex")}`;
};
