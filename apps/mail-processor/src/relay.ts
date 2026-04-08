import nodemailer from "nodemailer";
import { config } from "./config";
import { logger } from "./logger";
import { PROCESSED_HEADER, PROCESSED_HEADER_VALUE } from "./mime-rewriter";

/**
 * Relay a pre-built MIME message back to Exchange Online via the smart
 * host. Our droplet's IP is whitelisted on the inbound connector so no
 * authentication is required — Exchange trusts the connection by IP
 * and treats the message as internal.
 *
 * Exchange will then apply DKIM and deliver normally. The transport
 * rule exception on the X-ESP-Processed header prevents Exchange from
 * routing this message back to us in a loop.
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

/**
 * Prepend the X-ESP-Processed loop-prevention header to a raw MIME
 * buffer. SMTP headers can appear in any order so adding one at the
 * very top of the header block is always valid. We do this on EVERY
 * relay — including "unchanged" pass-throughs for disabled senders,
 * unknown senders and already-processed messages — so Exchange's
 * transport-rule exception reliably stops the message looping back.
 * Without this stamp, any email from a sender not in the database
 * (disabled, new employee, typo) bounces between the droplet and
 * Exchange until hop-count loop detection drops it.
 */
function stampProcessedHeader(rawMessage: Buffer): Buffer {
  const headerLine = `${PROCESSED_HEADER}: ${PROCESSED_HEADER_VALUE}\r\n`;
  return Buffer.concat([Buffer.from(headerLine), rawMessage]);
}

export async function relayMessage(
  rawMessage: Buffer,
  envelope: RelayEnvelope
): Promise<void> {
  const stamped = stampProcessedHeader(rawMessage);

  logger.info(
    { from: envelope.from, to: envelope.to, bytes: stamped.length },
    "Relaying processed message to smart host"
  );

  await transport.sendMail({
    envelope,
    raw: stamped,
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
