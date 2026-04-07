import pino from "pino";

export const logger = pino({
  name: "mail-processor",
  level: process.env.LOG_LEVEL ?? "info",
});
