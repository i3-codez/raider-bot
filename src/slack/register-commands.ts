import type { App } from "@slack/bolt";

import { registerRaidCommand } from "./commands/register-raid-command.js";
import { registerRaidSubmit } from "./commands/handle-raid-submit.js";
import { registerLeaderboardCommand } from "./commands/register-leaderboard-command.js";
import { registerMystatsCommand } from "./commands/register-mystats-command.js";
import { registerRaiderhelpCommand } from "./commands/register-raiderhelp-command.js";

export function registerCommands(app: App): void {
  registerRaidCommand(app);
  registerRaidSubmit(app);
  registerLeaderboardCommand(app);
  registerMystatsCommand(app);
  registerRaiderhelpCommand(app);
}
