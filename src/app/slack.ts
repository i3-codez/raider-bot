import { App, HTTPReceiver } from "@slack/bolt";

import { createPublishWebhookHandler, PUBLISH_WEBHOOK_ENDPOINT } from "./publish-webhook.js";
import { env } from "../config/env.js";
import { registerCommands } from "../slack/register-commands.js";
import { registerEvents } from "../slack/register-events.js";

export const SLACK_EVENTS_ENDPOINT = "/slack/events";

export interface SlackAppBootstrap {
  app: App;
  receiver: HTTPReceiver;
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
    ],
  });

  app = new App({
    receiver,
    token: env.SLACK_BOT_TOKEN,
  });

  registerCommands(app);
  registerEvents(app);

  return { app, receiver };
}
