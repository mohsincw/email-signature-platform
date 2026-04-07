import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { processMessage } from "./processor";
import { relayMessage } from "./relay";
import { logger } from "./logger";

export function createSmtpServer(): SMTPServer {
  return new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"], // TODO: Enable TLS for production
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", async () => {
        try {
          const raw = Buffer.concat(chunks);
          const parsed = await simpleParser(raw);
          const senderEmail =
            parsed.from?.value?.[0]?.address ?? session.envelope.mailFrom?.address;

          if (!senderEmail) {
            logger.warn("No sender email found, relaying unchanged");
            await relayMessage(raw, session.envelope);
            return callback();
          }

          logger.info({ sender: senderEmail }, "Processing message");

          const result = await processMessage(raw.toString(), parsed, senderEmail);
          await relayMessage(Buffer.from(result), session.envelope);

          callback();
        } catch (err) {
          logger.error({ err }, "Error processing message");
          callback(new Error("Processing failed"));
        }
      });
    },
  });
}
