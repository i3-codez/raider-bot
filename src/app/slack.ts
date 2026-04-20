import type { ServerResponse } from "node:http";

import { App, HTTPReceiver } from "@slack/bolt";

import { createPublishWebhookHandler, PUBLISH_WEBHOOK_ENDPOINT } from "./publish-webhook.js";
import { env } from "../config/env.js";
import { getSql } from "../db/sql.js";
import { logger } from "../lib/logger.js";
import { registerCommands } from "../slack/register-commands.js";
import { registerEvents } from "../slack/register-events.js";

export const SLACK_EVENTS_ENDPOINT = "/slack/events";
export const HEALTH_ENDPOINT = "/health";

export interface SlackAppBootstrap {
  app: App;
  receiver: HTTPReceiver;
}

function healthHandler(_req: unknown, res: ServerResponse): void {
  void (async () => {
    try {
      await getSql()`select 1`;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      logger.error({ err: error }, "Healthcheck DB probe failed.");
      res.statusCode = 503;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false }));
    }
  })();
}

export function createSlackApp(): SlackAppBootstrap {
  let app!: App;
  const receiver = new HTTPReceiver({
    endpoints: SLACK_EVENTS_ENDPOINT,
    signingSecret: env.SLACK_SIGNING_SECRET,
    customRoutes: [
      {
        path: PUBLISH_WEBHOOK_ENDPOINT,
        method: "POST",
        handler: (req, res) =>
          createPublishWebhookHandler({
            context: {
              client: app.client as Parameters<typeof createPublishWebhookHandler>[0]["context"]["client"],
            },
          })(req as never, res),
      },
      {
        path: HEALTH_ENDPOINT,
        method: "GET",
        handler: healthHandler as never,
      },
    ],
  });

  app = new App({
    receiver,
    token: env.SLACK_BOT_TOKEN,
  });

  app.error(async (error) => {
    logger.error({ err: error }, "Bolt handler error.");
  });

  registerCommands(app);
  registerEvents(app);

  return { app, receiver };
}
