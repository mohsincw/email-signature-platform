import { createSmtpServer } from "./smtp-server";
import { logger } from "./logger";

const port = parseInt(process.env.MAIL_PROCESSOR_PORT ?? "2525", 10);

const server = createSmtpServer();

server.listen(port, () => {
  logger.info({ port }, "Mail processor SMTP server listening");
});

process.on("SIGTERM", () => {
  logger.info("Shutting down mail processor");
  server.close(() => process.exit(0));
});
