import { createTransport } from "nodemailer";
import { logger } from "./logger";

// TODO: Configure Microsoft 365 outbound connector to accept relay from this service
// See docs/m365-routing.md for connector setup
const transport = createTransport({
  host: process.env.SMTP_RELAY_HOST ?? "localhost",
  port: parseInt(process.env.SMTP_RELAY_PORT ?? "25", 10),
  secure: false,
  tls: { rejectUnauthorized: false }, // TODO: Enable proper TLS verification in production
});

export async function relayMessage(
  rawMessage: Buffer,
  envelope: { mailFrom?: { address: string } | false; rcptTo: { address: string }[] }
): Promise<void> {
  const from = envelope.mailFrom ? envelope.mailFrom.address : undefined;
  const to = envelope.rcptTo.map((r) => r.address);

  logger.info({ from, to }, "Relaying message");

  await transport.sendMail({
    envelope: { from, to },
    raw: rawMessage,
  });
}
