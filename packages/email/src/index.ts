import { resend } from "./resend";
import { ResendBulkEmailOptions, ResendEmailOptions } from "./resend/types";
import { sendViaNodeMailer } from "./send-via-nodemailer";
import { sendBatchEmailViaResend, sendEmailViaResend } from "./send-via-resend";

// export const sendEmail = async (opts: ResendEmailOptions) => {
//   if (resend) {
//     return await sendEmailViaResend(opts);
//   }
//   console.log("smtp config", {
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT,
//   });
//   // Fallback to SMTP if Resend is not configured
//   const smtpConfigured = Boolean(
//     process.env.SMTP_HOST && process.env.SMTP_PORT
//   );

//   if (smtpConfigured) {
//     const { to, subject, text, react } = opts;
//     return await sendViaNodeMailer({
//       to,
//       subject,
//       text,
//       react,
//     });
//   }

//   console.info(
//     "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails."
//   );
// };

// export const sendBatchEmail = async (
//   emails: ResendBulkEmailOptions,
//   options?: { idempotencyKey?: string }
// ) => {
//   if (resend) {
//     return await sendBatchEmailViaResend(emails, options);
//   }

//   // Fallback to SMTP if Resend is not configured
//   const smtpConfigured = Boolean(
//     process.env.SMTP_HOST && process.env.SMTP_PORT
//   );

//   if (smtpConfigured) {
//     await Promise.all(
//       emails.map((p) =>
//         sendViaNodeMailer({
//           ...p,
//         })
//       )
//     );

//     return {
//       data: null,
//       error: null,
//     };
//   }

//   console.info(
//     "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails."
//   );

//   return {
//     data: null,
//     error: null,
//   };
// };

// export default {
//   sendEmail,
//   sendBatchEmail,
// };


export * from "./pdf/generate-weekly-report";
export type { WeeklySummaryStats } from "./pdf/types";

export const sendEmail = async (opts: ResendEmailOptions) => {


  if (resend) {
    return await sendEmailViaResend(opts);
  }
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT
  );

  if (smtpConfigured) {
    const { to, subject, text, react, attachments } = opts; // ← added attachments
    return await sendViaNodeMailer({
      to,
      subject,
      text,
      react,
      attachments, // ← forward it through
    });
  }

  console.info(
    "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails."
  );
};

export const sendBatchEmail = async (
  emails: ResendBulkEmailOptions,
  options?: { idempotencyKey?: string }
) => {
 
  if (resend) {
    return await sendBatchEmailViaResend(emails, options);
  }

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT
  );

  if (smtpConfigured) {
    // This branch was already fine — spreading `p` forwards attachments
    // through untouched, unlike the single-send path above.
    await Promise.all(
      emails.map((p) =>
        sendViaNodeMailer({
          ...p,
        })
      )
    );

    return {
      data: null,
      error: null,
    };
  }

  console.info(
    "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails."
  );

  return {
    data: null,
    error: null,
  };
};

export default {
  sendEmail,
  sendBatchEmail,
};