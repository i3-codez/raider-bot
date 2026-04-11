import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { createSlackApp } from "./slack.js";

async function main() {
  const { app } = createSlackApp();

  await app.start(env.APP_PORT);

  logger.info(
    { port: env.APP_PORT, endpoint: "/slack/events" },
    "Raider Bot Slack app listening.",
  );
}

void main().catch((error) => {
  logger.error({ err: error }, "Failed to start Raider Bot Slack app.");
  process.exitCode = 1;
});
