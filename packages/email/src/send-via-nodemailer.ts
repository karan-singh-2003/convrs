import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { CreateEmailOptions } from "resend";

export const sendViaNodeMailer = async ({
  to,
  subject,
  text,
  react,
}: Pick<CreateEmailOptions, "subject" | "text" | "react"> & {
  to: string;
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
    console.log("[nodemailer] SMTP connection verified");

    const html = react ? await render(react as React.ReactElement) : undefined;

    const result = await transporter.sendMail({
      from: "noreply@example.com",
      to,
      subject,
      text,
      html,
    });

    console.log("[nodemailer] Email sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("[nodemailer] Failed to send email:", error);
    throw error;
  }
};