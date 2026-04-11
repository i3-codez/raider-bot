import type { App } from "@slack/bolt";

import { ACTION_REGISTRY } from "../../domain/scoring/action-registry.js";
import { SCORING_WINDOWS } from "../../domain/scoring/scoring-config.js";

export interface HandleRaiderhelpCommandArgs {
  ack(): Promise<void>;
  respond(payload: {
    response_type: "ephemeral";
    text: string;
  }): Promise<unknown>;
}

function buildRaiderHelpText(): string {
  const actionLines = ACTION_REGISTRY.map((action) => `:${action.emoji}: = ${action.label}`);
  const windowLines = SCORING_WINDOWS.map((window) => `${window.label}: ${window.points} pts`);

  return [
    "Raider Bot help",
    "",
    "Actions:",
    ...actionLines,
    "",
    "Scoring windows:",
    ...windowLines,
  ].join("\n");
}

export async function handleRaiderhelpCommand(args: HandleRaiderhelpCommandArgs): Promise<void> {
  await args.ack();

  await args.respond({
    response_type: "ephemeral",
    text: buildRaiderHelpText(),
  });
}

export function registerRaiderhelpCommand(app: App): void {
  app.command("/raiderhelp", async ({ ack, respond }) => {
    await handleRaiderhelpCommand({
      ack,
      respond,
    });
  });
}
