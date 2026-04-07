import nodemailer from "nodemailer";

export function createTransport() {
  const smtpHost = process.env.SMTP_HOST ?? "smtp.office365.com";
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const smtpUser = process.env.SMTP_USER ?? "";
  const smtpPass = process.env.SMTP_PASS ?? "";

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  } as nodemailer.TransportOptions);
}

export function defaultFromAddress() {
  return process.env.SMTP_USER || `"Signature Test" <noreply@chaiiwala.co.uk>`;
}
