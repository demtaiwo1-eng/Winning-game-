import nodemailer from "nodemailer";
import { env } from "../config/env";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    console.info(`[ESS] Password reset URL for ${to}: ${resetUrl}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Reset your EPHINTA password",
    text: `Reset your password using this link: ${resetUrl}\n\nThis link expires in 30 minutes.`,
    html: `<p>Reset your EPHINTA password.</p><p><a href="${resetUrl}">Create a new password</a></p><p>This link expires in 30 minutes.</p>`,
  });
}

export async function sendVerificationEmail(to: string, verificationUrl: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    console.info(`[EPHINTA] Email verification URL for ${to}: ${verificationUrl}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Verify your EPHINTA email address",
    text: `Verify your email address using this link: ${verificationUrl}\\n\\nThis link expires in 24 hours. If you did not create an EPHINTA account, ignore this email.`,
    html: `<p>Welcome to EPHINTA. Confirm your email address to complete account setup.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
  });
}
