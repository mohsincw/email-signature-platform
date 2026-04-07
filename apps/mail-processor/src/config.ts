/**
 * Environment configuration for the mail processor.
 * Fails fast at startup if required vars are missing.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // --- SMTP listener (inbound from Exchange) ---
  smtpPort: parseInt(optional("SMTP_PORT", "25"), 10),
  submissionPort: parseInt(optional("SUBMISSION_PORT", "587"), 10),
  hostname: optional("HOSTNAME", "mail-relay.chaiiwala.co.uk"),
  tlsCertPath: optional(
    "TLS_CERT_PATH",
    "/etc/letsencrypt/live/mail-relay.chaiiwala.co.uk/fullchain.pem"
  ),
  tlsKeyPath: optional(
    "TLS_KEY_PATH",
    "/etc/letsencrypt/live/mail-relay.chaiiwala.co.uk/privkey.pem"
  ),

  // --- Smart host for relay back to Microsoft ---
  // Microsoft's MX endpoint for chaiiwala.co.uk — configured via the
  // inbound connector so our IP is trusted without auth.
  smartHostHost: optional(
    "SMART_HOST_HOST",
    "chaiiwala-co-uk.mail.protection.outlook.com"
  ),
  smartHostPort: parseInt(optional("SMART_HOST_PORT", "25"), 10),

  // --- Database (Supabase) ---
  databaseUrl: required("DATABASE_URL"),

  // --- Font path for the PNG renderer ---
  fontPath: optional(
    "FONT_PATH",
    "/app/packages/signature-png/fonts/myriad-pro-black.otf"
  ),

  // --- HTTP health endpoint ---
  healthPort: parseInt(optional("HEALTH_PORT", "8080"), 10),

  // --- Misc ---
  logLevel: optional("LOG_LEVEL", "info"),
  nodeEnv: optional("NODE_ENV", "production"),
};
