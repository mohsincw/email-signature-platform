import nodemailer from "nodemailer";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Relay a pre-built MIME message back to Exchange Online via the smart
 * host. Our droplet's IP is whitelisted on the inbound connector so no
 * authentication is required — Exchange trusts the connection by IP
 * and treats the message as internal.
 *
 * Exchange will then apply DKIM and deliver normally. The transport
 * rule exception on the X-ESP-Processed header prevents Exchange from
 * routing this message back to us in a loop.
 *
 * The raw buffer passed in MUST already be a cleanly-rebuilt MIME
 * (via rewriteMessageWithSignature or rebuildMessageForRelay) with
 * the X-ESP-Processed header embedded in its header block. Earlier
 * attempts to prepend the header to the raw SMTP bytes here did not
 * work — Exchange still saw the previous hop's Received: chain and
 * bounced with "hop count exceeded". Rebuilding upstream drops the
 * accumulated routing headers, which is what actually breaks the loop.
 */
const transport = nodemailer.createTransport({
  host: config.smartHostHost,
  port: config.smartHostPort,
  secure: false, // Microsoft upgrades to STARTTLS automatically
  requireTLS: true,
  tls: {
    servername: config.smartHostHost,
  },
  // Tell nodemailer our own hostname — Microsoft checks this matches
  // our PTR / forward DNS to avoid appearing as open relay spam.
  name: config.hostname,
});

export interface RelayEnvelope {
  from: string;
  to: string[];
}

export async function relayMessage(
  rawMessage: Buffer,
  envelope: RelayEnvelope
): Promise<void> {
  logger.info(
    { from: envelope.from, to: envelope.to, bytes: rawMessage.length },
    "Relaying processed message to smart host"
  );

  await transport.sendMail({
    envelope,
    raw: rawMessage,
  });
}

export async function verifySmartHost(): Promise<boolean> {
  try {
    await transport.verify();
    return true;
  } catch (err) {
    logger.warn({ err }, "Smart host verification failed");
    return false;
  }
}
