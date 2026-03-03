export const WEBHOOK_TRIGGERS = [
  "workspace.created",
  "workspace.updated",
  "workspace.deleted",
] as const;

export const WEBHOOK_SECRET_TOKEN_LENGTH = 16;

export const WEBHOOK_SECRET_PREFIX = "whsec_";

export const WEBHOOK_FAILURE_NOTIFY_THRESHOLDS = [5, 10, 15] as const;
export const WEBHOOK_FAILURE_DISABLE_THRESHOLD = 20 as const;
