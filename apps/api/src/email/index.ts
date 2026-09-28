import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "no-reply@periscopiosaude.com.br",
    to,
    subject,
    html,
  });
}
