import pino from "pino";

import { env } from "../config/env.js";

export const redactPaths = [
  "DATABASE_URL",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "env.DATABASE_URL",
  "env.SLACK_BOT_TOKEN",
  "env.SLACK_SIGNING_SECRET",
] as const;

export function createLogger() {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [...redactPaths],
      censor: "[Redacted]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger();
