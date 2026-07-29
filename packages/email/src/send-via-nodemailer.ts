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
    console.dir({ to, subject, text, html, attachments }, { depth: null });
    const result = await transporter.sendMail({
      from: "noreply@example.com",
      to,
      subject,
      text,
      html,
      attachments,
    });
    console.log("in mailer")
    console.dir(result, { depth: null });
    return result;
  } catch (error) {
    console.error("[nodemailer] Failed to send email:", error);
    throw error;
  }
};