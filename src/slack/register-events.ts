import type { App } from "@slack/bolt";

import { registerReactionHandlers } from "./events/register-reaction-handlers.js";

export function registerEvents(app: App): void {
  registerReactionHandlers(app);
}
