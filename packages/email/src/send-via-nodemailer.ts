import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { CreateEmailOptions } from "resend";

export const sendViaNodeMailer = async ({
  to,
  subject,
  text,
  react,
  attachments
}: Pick<CreateEmailOptions, "subject" | "text" | "react"> & {
  to: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT), // ← was string, needs to be number
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();


    const html = react ? await render(react as React.ReactElement) : undefined;
    // attachments arrive with base64-encoded `content` strings (Resend's
    // format); nodemailer treats a string `content` as utf-8 unless told
    // otherwise, which would corrupt binary attachments like the PDF report.
    const normalizedAttachments = attachments?.map((attachment) =>
      typeof attachment.content === "string" && !attachment.encoding
        ? { ...attachment, encoding: "base64" as const }
        : attachment
    );
    const result = await transporter.sendMail({
      from: "noreply@example.com",
      to,
      subject,
      text,
      html,
      attachments: normalizedAttachments,
    });
    console.log("in mailer")
    console.dir(result, { depth: null });
    return result;
  } catch (error) {
    console.error("[nodemailer] Failed to send email:", error);
    throw error;
  }
};