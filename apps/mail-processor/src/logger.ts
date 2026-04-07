import pino from "pino";
import { config } from "./config";

export const logger = pino({
  name: "mail-processor",
  level: config.logLevel,
  ...(config.nodeEnv === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});
