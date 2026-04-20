import { env } from "../config/env.js";
import { closeSql } from "../db/sql.js";
import { logger } from "../lib/logger.js";
import { createSlackApp, SLACK_EVENTS_ENDPOINT } from "./slack.js";
import { PUBLISH_WEBHOOK_ENDPOINT } from "./publish-webhook.js";

const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"] as const;
const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

async function main() {
  const { app } = createSlackApp();

  await app.start(env.APP_PORT);

  logger.info(
    { port: env.APP_PORT, endpoints: [SLACK_EVENTS_ENDPOINT, PUBLISH_WEBHOOK_ENDPOINT] },
    "Raider Bot Slack app listening.",
  );

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Received shutdown signal; draining.");

    try {
      await app.stop();
    } catch (error) {
      logger.error({ err: error }, "Failed to stop Bolt app cleanly.");
    }

    try {
      await closeSql({ timeout: SHUTDOWN_DRAIN_TIMEOUT_MS / 1000 });
    } catch (error) {
      logger.error({ err: error }, "Failed to close Postgres pool cleanly.");
    }

    process.exit(0);
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => void shutdown(signal));
  }
}

void main().catch((error) => {
  logger.error({ err: error }, "Failed to start Raider Bot Slack app.");
  process.exitCode = 1;
});
