import type { App } from "@slack/bolt";

import { registerRaidCommand } from "./commands/register-raid-command.js";
import { registerRaidSubmit } from "./commands/handle-raid-submit.js";

export function registerCommands(app: App): void {
  registerRaidCommand(app);
  registerRaidSubmit(app);
}
