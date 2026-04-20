import type { App } from "@slack/bolt";

import {
  getMonthlyLeaderboard,
  type GetMonthlyLeaderboardDependencies,
} from "../../domain/reporting/monthly-reporting.js";
import { resolveUserNames, type SlackUsersInfoClient } from "../lib/resolve-user-names.js";

interface RespondPayload {
  response_type: "in_channel" | "ephemeral";
  text: string;
}

export interface HandleLeaderboardCommandArgs {
  ack(): Promise<void>;
  respond(payload: RespondPayload): Promise<unknown>;
  client: SlackUsersInfoClient;
}

export interface HandleLeaderboardCommandDependencies
  extends GetMonthlyLeaderboardDependencies {
  resolveUserNames?: typeof resolveUserNames;
}

function buildLeaderboardText(
  entries: Awaited<ReturnType<typeof getMonthlyLeaderboard>>,
  names: Map<string, string>,
): string {
  if (entries.length === 0) {
    return "No leaderboard activity yet this month.";
  }

  const lines = entries.map((entry, index) => {
    const name = names.get(entry.slackUserId) ?? entry.slackUserId;
    return `${index + 1}. ${name} - ${entry.totalPoints} pts (${entry.uniqueRaidsEngaged} raids, ${entry.earlyWindowActions} early actions)`;
  });

  return `Current monthly leaderboard:\n${lines.join("\n")}`;
}

export async function handleLeaderboardCommand(
  args: HandleLeaderboardCommandArgs,
  dependencies: HandleLeaderboardCommandDependencies = {},
): Promise<void> {
  await args.ack();

  const leaderboard = await getMonthlyLeaderboard({}, dependencies);
  const resolver = dependencies.resolveUserNames ?? resolveUserNames;
  const names = await resolver(
    args.client,
    leaderboard.map((entry) => entry.slackUserId),
  );

  await args.respond({
    response_type: "in_channel",
    text: buildLeaderboardText(leaderboard, names),
  });
}

export function registerLeaderboardCommand(app: App): void {
  app.command("/leaderboard", async ({ ack, respond, client }) => {
    await handleLeaderboardCommand({
      ack,
      respond,
      client: client as unknown as SlackUsersInfoClient,
    });
  });
}
