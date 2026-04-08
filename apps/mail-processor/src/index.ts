import "dotenv/config";
import { config } from "./config";
import { createSmtpServer } from "./smtp-server";
import { startHealthServer } from "./health";
import { logger } from "./logger";
import { disconnectPrisma } from "./sender-lookup";
import { verifySmartHost } from "./relay";

// ── Process-level safety net ─────────────────────────────────────────
// A public SMTP server on port 25 gets hammered by scanners. If ANY
// error slips past the smtp-server event handler, we log and keep
// running instead of crashing. This is defence in depth — the real
// fix is in smtp-server.ts, but belt-and-braces is warranted given
// how much bot traffic we see.
process.on("uncaughtException", (err: any) => {
  const benign = new Set([
    "ERR_SSL_NO_SHARED_CIPHER",
    "ERR_SSL_WRONG_VERSION_NUMBER",
    "ERR_SSL_UNEXPECTED_EOF_WHILE_READING",
    "ERR_SSL_TLSV1_ALERT_UNKNOWN_CA",
    "ECONNRESET",
    "EPIPE",
  ]);
  if (err && benign.has(err.code)) {
    logger.debug(
      { code: err.code, msg: err.message },
      "uncaught benign SMTP error (ignored)"
    );
    return;
  }
  logger.fatal({ err }, "uncaughtException — continuing");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});

async function main() {
  logger.info(
    {
      hostname: config.hostname,
      smtpPort: config.smtpPort,
      submissionPort: config.submissionPort,
      smartHost: `${config.smartHostHost}:${config.smartHostPort}`,
    },
    "Starting Chaiiwala mail signature relay"
  );

  // Warn loudly (but don't crash) if the smart host isn't reachable —
  // it might just be that the Exchange inbound connector isn't set up
  // yet, which the operator will fix next.
  void verifySmartHost().then((ok) => {
    if (ok) {
      logger.info("Smart host is reachable");
    } else {
      logger.warn(
        "Smart host verification failed — Exchange inbound connector may not be configured yet"
      );
    }
  });

  const server = await createSmtpServer();

  server.listen(config.smtpPort, () => {
    logger.info({ port: config.smtpPort }, "SMTP server listening on port 25");
  });

  // A second listener on the submission port (587) with the same
  // handler — lets clients that can't talk to port 25 still connect.
  const submissionServer = await createSmtpServer();
  submissionServer.listen(config.submissionPort, () => {
    logger.info(
      { port: config.submissionPort },
      "SMTP submission listener on port 587"
    );
  });

  startHealthServer();

  const shutdown = async (sig: string) => {
    logger.info({ sig }, "Shutting down");
    server.close();
    submissionServer.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
