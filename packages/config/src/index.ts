function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getS3Config() {
  return {
    endpoint: required("S3_ENDPOINT"),
    region: optional("S3_REGION", "us-east-1"),
    bucket: required("S3_BUCKET"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    publicUrl: required("S3_PUBLIC_URL"),
  };
}

export function getSmtpRelayConfig() {
  return {
    host: required("SMTP_RELAY_HOST"),
    port: parseInt(optional("SMTP_RELAY_PORT", "25"), 10),
  };
}

export function getMailProcessorConfig() {
  return {
    listenPort: parseInt(optional("MAIL_PROCESSOR_PORT", "2525"), 10),
    apiBaseUrl: required("API_BASE_URL"),
  };
}
