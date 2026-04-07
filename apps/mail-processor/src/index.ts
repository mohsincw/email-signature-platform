import "dotenv/config";
import { config } from "./config";
import { createSmtpServer } from "./smtp-server";
import { startHealthServer } from "./health";
import { logger } from "./logger";
import { disconnectPrisma } from "./sender-lookup";
import { verifySmartHost } from "./relay";

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
