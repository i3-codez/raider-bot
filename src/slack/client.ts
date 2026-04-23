import { WebClient } from "@slack/web-api";

import { env } from "../config/env.js";
import type { SlackUsersInfoClient } from "./lib/resolve-user-names.js";

export interface SlackPostingClient {
  chat: {
    postMessage(payload: {
      channel: string;
      text: string;
      blocks: unknown[];
    }): Promise<unknown>;
  };
}

export interface SlackCanvasSection {
  id: string;
}

export interface SlackCanvasDocumentContent {
  type: "markdown";
  markdown: string;
}

export type SlackCanvasChange =
  | {
      operation: "insert_at_start" | "insert_at_end";
      document_content: SlackCanvasDocumentContent;
    }
  | {
      operation: "insert_after" | "insert_before" | "replace";
      section_id: string;
      document_content: SlackCanvasDocumentContent;
    }
  | {
      operation: "delete";
      section_id: string;
    };

export interface SlackCanvasClient {
  canvases: {
    edit(payload: {
      canvas_id: string;
      changes: SlackCanvasChange[];
    }): Promise<unknown>;
    sections: {
      lookup(payload: {
        canvas_id: string;
        criteria:
          | { contains_text: string; section_types?: string[] }
          | { section_types: string[]; contains_text?: string };
      }): Promise<{ sections: SlackCanvasSection[] }>;
    };
  };
}

export type SlackClient = SlackPostingClient & SlackCanvasClient & SlackUsersInfoClient;

export function createSlackClient(token: string = env.SLACK_BOT_TOKEN): SlackClient {
  return new WebClient(token) as unknown as SlackClient;
}
