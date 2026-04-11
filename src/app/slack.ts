import { App, HTTPReceiver } from "@slack/bolt";

import { env } from "../config/env.js";
import { registerCommands } from "../slack/register-commands.js";
import { registerEvents } from "../slack/register-events.js";

export const SLACK_EVENTS_ENDPOINT = "/slack/events";

export interface SlackAppBootstrap {
  app: App;
  receiver: HTTPReceiver;
}

export function createSlackApp(): SlackAppBootstrap {
  const receiver = new HTTPReceiver({
    endpoints: SLACK_EVENTS_ENDPOINT,
    signingSecret: env.SLACK_SIGNING_SECRET,
  });

  const app = new App({
    receiver,
    token: env.SLACK_BOT_TOKEN,
  });

  registerCommands(app);
  registerEvents(app);

  return { app, receiver };
}
