import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { createSlackApp, SLACK_EVENTS_ENDPOINT } from "./slack.js";
import { PUBLISH_WEBHOOK_ENDPOINT } from "./publish-webhook.js";

async function main() {
  const { app } = createSlackApp();

  await app.start(env.APP_PORT);

  logger.info(
    { port: env.APP_PORT, endpoints: [SLACK_EVENTS_ENDPOINT, PUBLISH_WEBHOOK_ENDPOINT] },
    "Raider Bot Slack app listening.",
  );
}

void main().catch((error) => {
  logger.error({ err: error }, "Failed to start Raider Bot Slack app.");
  process.exitCode = 1;
});
