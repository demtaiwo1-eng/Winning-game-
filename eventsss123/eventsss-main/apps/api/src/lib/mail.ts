import nodemailer from "nodemailer";
import { env } from "../config/env";

async function sendTransactionalEmail(to: string, subject: string, textContent: string, htmlContent: string) {
  if (env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json", "api-key": env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME || "EPHINTA" },
        to: [{ email: to }], subject, textContent, htmlContent,
      }),
    });
    if (!response.ok) throw new Error(`Brevo email delivery failed with HTTP ${response.status}`);
    return;
  }
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production") throw new Error("Brevo or SMTP email delivery is not configured");
    console.info(`[EPHINTA] Email preview for ${to}: ${subject}`);
    return;
  }
  const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text: textContent, html: htmlContent });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendTransactionalEmail(to, "Reset your EPHINTA password",
    `Reset your password using this link: ${resetUrl}\n\nThis link expires in 30 minutes.`,
    `<p>Reset your EPHINTA password.</p><p><a href="${resetUrl}">Create a new password</a></p><p>This link expires in 30 minutes.</p>`);
}

export async function sendVerificationEmail(to: string, verificationUrl: string) {
  await sendTransactionalEmail(to, "Verify your EPHINTA email address",
    `Verify your email address using this link: ${verificationUrl}\n\nThis link expires in 24 hours. If you did not create an EPHINTA account, ignore this email.`,
    `<p>Welcome to EPHINTA. Confirm your email address to complete account setup.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`);
}
