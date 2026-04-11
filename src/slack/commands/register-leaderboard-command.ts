import type { App } from "@slack/bolt";

import {
  getMonthlyLeaderboard,
  type GetMonthlyLeaderboardDependencies,
} from "../../domain/reporting/monthly-reporting.js";

interface RespondPayload {
  response_type: "in_channel" | "ephemeral";
  text: string;
}

export interface HandleLeaderboardCommandArgs {
  ack(): Promise<void>;
  respond(payload: RespondPayload): Promise<unknown>;
}

export interface HandleLeaderboardCommandDependencies
  extends GetMonthlyLeaderboardDependencies {}

function buildLeaderboardText(entries: Awaited<ReturnType<typeof getMonthlyLeaderboard>>): string {
  if (entries.length === 0) {
    return "No leaderboard activity yet this month.";
  }

  const lines = entries.map(
    (entry, index) =>
      `${index + 1}. ${entry.displayName} - ${entry.totalPoints} pts (${entry.uniqueRaidsEngaged} raids, ${entry.earlyWindowActions} early actions)`,
  );

  return `Current monthly leaderboard:\n${lines.join("\n")}`;
}

export async function handleLeaderboardCommand(
  args: HandleLeaderboardCommandArgs,
  dependencies: HandleLeaderboardCommandDependencies = {},
): Promise<void> {
  await args.ack();

  const leaderboard = await getMonthlyLeaderboard({}, dependencies);

  await args.respond({
    response_type: "in_channel",
    text: buildLeaderboardText(leaderboard),
  });
}

export function registerLeaderboardCommand(app: App): void {
  app.command("/leaderboard", async ({ ack, respond }) => {
    await handleLeaderboardCommand({
      ack,
      respond,
    });
  });
}
