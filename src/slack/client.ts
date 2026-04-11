import { WebClient } from "@slack/web-api";

import { env } from "../config/env.js";

export interface SlackPostingClient {
  chat: {
    postMessage(payload: {
      channel: string;
      text: string;
      blocks: unknown[];
    }): Promise<unknown>;
  };
}

export function createSlackClient(token: string = env.SLACK_BOT_TOKEN): SlackPostingClient {
  return new WebClient(token) as unknown as SlackPostingClient;
}
