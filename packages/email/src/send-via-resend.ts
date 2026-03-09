import type { CreateEmailOptions } from "resend";
import { resend } from "./resend";
import { VARIANT_TO_FROM_MAP } from "./resend/constants";
import { ResendBulkEmailOptions, ResendEmailOptions } from "./resend/types";

const resendEmailForOptions = (
  opts: ResendEmailOptions
): CreateEmailOptions => {
  const {
    to,
    from,
    variant = "primary",
    bcc,
    replyTo,
    subject,
    text,
    react,
    scheduledAt,
    headers,
    tags,
    unsubscribeUrl,
  } = opts;
  console.log("EMAIL SENDER:", from || VARIANT_TO_FROM_MAP[variant]);
  // Build base options without rendered outputs (react/text)
  const baseOptions = {
    to,
    from:
      from ||
      VARIANT_TO_FROM_MAP[variant] ||
      "BoilerCode <noreply@send.boilercode.dev>",
    subject: subject!,
    bcc,

    // if replyTo is set to "noreply", don't set replyTo
    // else fallback to support@boilercode.dev
    ...(replyTo === "noreply"
      ? {}
      : { replyTo: replyTo || "support@boilercode.dev" }),

    scheduledAt,
    tags,

    ...(variant === "marketing"
      ? {
          headers: {
            ...(headers || {}),
            "List-Unsubscribe":
              unsubscribeUrl || "https://app.boilercode.dev/account/settings",
          },
        }
      : headers && { headers }),
  };

  // At least one of react or text must exist
  if (react) {
    return { ...baseOptions, react };
  }

  if (text) {
    return { ...baseOptions, text };
  }

  return { ...baseOptions, text: "" };
};

// Send single email
export const sendEmailViaResend = async (opts: ResendEmailOptions) => {
  if (!resend) {
    console.info(
      "RESEND_API_KEY is not set in the .env. Skipping sending email."
    );
    return;
  }

  return await resend.emails.send(resendEmailForOptions(opts));
};

// Send batch emails
export const sendBatchEmailViaResend = async (
  emails: ResendBulkEmailOptions,
  options?: { idempotencyKey?: string }
) => {
  if (!resend) {
    console.info(
      "RESEND_API_KEY is not set in the .env. Skipping sending email."
    );

    return {
      data: null,
      error: null,
    };
  }

  if (emails.length === 0) {
    return {
      data: null,
      error: null,
    };
  }

  const filteredBatch = emails.reduce(
    (acc, email) => {
      if (!email?.to) return acc;

      acc.push(resendEmailForOptions(email));
      return acc;
    },
    [] as ReturnType<typeof resendEmailForOptions>[]
  );

  if (filteredBatch.length === 0) {
    return {
      data: null,
      error: null,
    };
  }

  const idempotencyKey = options?.idempotencyKey || undefined;

  return await resend.batch.send(
    filteredBatch,
    idempotencyKey ? { idempotencyKey } : undefined
  );
};
