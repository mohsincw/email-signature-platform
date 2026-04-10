import { SMTPServer, type SMTPServerAuthentication } from "smtp-server";
import { promises as fs } from "fs";
import {
  rewriteMessageWithSignature,
  isAlreadyProcessed,
  extractSenderEmail,
} from "./mime-rewriter";
import { lookupSender } from "./sender-lookup";
import { relayMessage } from "./relay";
import { recordEvent } from "./event-log";
import { logger } from "./logger";
import { config } from "./config";

interface TlsOptions {
  key: Buffer;
  cert: Buffer;
}

async function loadTlsOptions(): Promise<TlsOptions | null> {
  try {
    const [key, cert] = await Promise.all([
      fs.readFile(config.tlsKeyPath),
      fs.readFile(config.tlsCertPath),
    ]);
    return { key, cert };
  } catch (err) {
    logger.warn(
      { err, certPath: config.tlsCertPath, keyPath: config.tlsKeyPath },
      "TLS cert/key not found — STARTTLS will be disabled"
    );
    return null;
  }
}

export async function createSmtpServer(): Promise<SMTPServer> {
  const tls = await loadTlsOptions();

  const server = new SMTPServer({
    name: config.hostname,
    banner: `${config.hostname} ESMTP Chaiiwala Email Signature Relay`,
    authOptional: true,
    // TLS is opportunistic — Exchange prefers STARTTLS but we don't
    // reject plain connections in case the cert is missing at boot.
    secure: false,
    ...(tls ? { key: tls.key, cert: tls.cert } : { disabledCommands: ["STARTTLS"] }),
    size: 25 * 1024 * 1024, // 25MB max message size
    // Accept mail from anyone on the network level — IP filtering is
    // done by the firewall / Exchange connector, not here. This lets
    // us also accept local health checks without setup.
    onAuth(auth: SMTPServerAuthentication, _session, callback) {
      // Accept any auth — Exchange inbound connector uses IP trust,
      // not SMTP AUTH, so this path is rarely hit.
      callback(null, { user: auth.username });
    },
    async onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", (err) => {
        logger.error({ err }, "Stream error while reading message body");
        callback(new Error("Stream error"));
      });
      stream.on("end", async () => {
        const raw = Buffer.concat(chunks);

        // Build the envelope for relay from the SMTP session's
        // envelope fields (not the parsed From/To — the envelope is
        // what the routing layer actually uses).
        const envFrom = session.envelope.mailFrom
          ? session.envelope.mailFrom.address
          : "";
        const envTo = session.envelope.rcptTo.map((r) => r.address);

        try {
          // Loop prevention — relay.ts already stamps X-ESP-Processed
          // on every relay so Exchange's transport-rule exception will
          // see it and stop routing the message back to us. For pass-
          // through paths (already processed, no sender in DB, no From
          // header) we relay the ORIGINAL raw bytes untouched. We must
          // NOT rebuild the MIME because simpleParser destroys TNEF
          // content (turns it into a winmail.dat attachment), which
          // mangles messages from Outlook users composing in Rich
          // Text format.
          if (await isAlreadyProcessed(raw)) {
            logger.info(
              { from: envFrom, to: envTo },
              "Message already has X-ESP-Processed header — relaying unchanged"
            );
            await relayMessage(raw, { from: envFrom, to: envTo });
            await recordEvent({
              senderEmail: envFrom,
              recipients: envTo,
              status: "already_processed",
              reason: "loop guard",
              originalBytes: raw.length,
            });
            return callback();
          }

          // Find the logical sender — prefer the parsed From header
          // over the envelope because the envelope MAIL FROM is
          // sometimes the server itself or a bounce address.
          const senderEmail = (await extractSenderEmail(raw)) ?? envFrom;
          if (!senderEmail) {
            logger.warn("No sender email found — relaying unchanged");
            await relayMessage(raw, { from: envFrom, to: envTo });
            await recordEvent({
              senderEmail: envFrom || "(unknown)",
              recipients: envTo,
              status: "passthrough",
              reason: "no From header",
              originalBytes: raw.length,
            });
            return callback();
          }

          const senderData = await lookupSender(senderEmail);
          if (!senderData) {
            logger.info(
              { senderEmail },
              "No matching sender in DB — relaying unchanged (no signature)"
            );
            await relayMessage(raw, { from: envFrom, to: envTo });
            await recordEvent({
              senderEmail,
              recipients: envTo,
              status: "passthrough",
              reason: "sender not in directory",
              originalBytes: raw.length,
            });
            return callback();
          }

          const { raw: rewritten } = await rewriteMessageWithSignature(
            raw,
            senderData
          );
          logger.info(
            {
              senderEmail,
              originalBytes: raw.length,
              rewrittenBytes: rewritten.length,
              recipients: envTo.length,
            },
            "Signature injected"
          );

          await relayMessage(rewritten, { from: envFrom, to: envTo });
          await recordEvent({
            senderEmail,
            senderName: senderData.sender.name,
            recipients: envTo,
            status: "signed",
            originalBytes: raw.length,
            rewrittenBytes: rewritten.length,
          });
          callback();
        } catch (err) {
          logger.error({ err, from: envFrom, to: envTo }, "Processing failed");
          await recordEvent({
            senderEmail: envFrom || "(unknown)",
            recipients: envTo,
            status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            originalBytes: raw.length,
          });
          callback(new Error("Processing failed"));
        }
      });
    },
  });

  // ── Error handler — CRITICAL ────────────────────────────────────
  //
  // A public SMTP server on port 25 will be probed constantly by
  // internet scanners. Some of them attempt STARTTLS with ancient
  // cipher suites, triggering `ERR_SSL_NO_SHARED_CIPHER` during the
  // handshake. The underlying Node TLS socket emits an 'error' event
  // which — if unhandled — crashes the entire process (Docker then
  // restarts us, another bot probes within 30s, the cycle repeats).
  //
  // We absorb all transient TLS and socket errors here and only log
  // at debug level. Real issues (cert missing, module loading, etc.)
  // still surface as exceptions elsewhere.
  server.on("error", (err: any) => {
    const benign = new Set([
      "ERR_SSL_NO_SHARED_CIPHER",
      "ERR_SSL_WRONG_VERSION_NUMBER",
      "ERR_SSL_UNEXPECTED_EOF_WHILE_READING",
      "ERR_SSL_TLSV1_ALERT_UNKNOWN_CA",
      "ECONNRESET",
      "EPIPE",
      "ETIMEDOUT",
    ]);
    if (err && benign.has(err.code)) {
      logger.debug(
        { code: err.code, remote: err.remoteAddress },
        "ignored transient SMTP handshake error"
      );
      return;
    }
    logger.warn({ err }, "SMTP server error");
  });

  return server;
}
