import type { App } from "@slack/bolt";

import {
  getMemberMonthlyStats,
  type GetMemberMonthlyStatsDependencies,
} from "../../domain/reporting/monthly-reporting.js";
import { resolveUserNames, type SlackUsersInfoClient } from "../lib/resolve-user-names.js";

export interface HandleMystatsCommandArgs {
  ack(): Promise<void>;
  command: {
    user_id: string;
  };
  respond(payload: {
    response_type: "ephemeral";
    text: string;
  }): Promise<unknown>;
  client: SlackUsersInfoClient;
}

export interface HandleMystatsCommandDependencies extends GetMemberMonthlyStatsDependencies {
  resolveUserNames?: typeof resolveUserNames;
}

function buildStatsText(
  stats: Awaited<ReturnType<typeof getMemberMonthlyStats>>,
  displayName: string,
): string {
  if (!stats) {
    return `No tracked activity yet this month for ${displayName}.`;
  }

  return [
    `${displayName} this month:`,
    `- Total points: ${stats.totalPoints}`,
    `- Unique raids engaged: ${stats.uniqueRaidsEngaged}`,
    `- Early-window actions: ${stats.earlyWindowActions}`,
    `- Total actions: ${stats.totalActions}`,
  ].join("\n");
}

export async function handleMystatsCommand(
  args: HandleMystatsCommandArgs,
  dependencies: HandleMystatsCommandDependencies = {},
): Promise<void> {
  await args.ack();

  const stats = await getMemberMonthlyStats(
    {
      slackUserId: args.command.user_id,
    },
    dependencies,
  );

  const resolver = dependencies.resolveUserNames ?? resolveUserNames;
  const names = await resolver(args.client, [args.command.user_id]);
  const displayName = names.get(args.command.user_id) ?? args.command.user_id;

  await args.respond({
    response_type: "ephemeral",
    text: buildStatsText(stats, displayName),
  });
}

export function registerMystatsCommand(app: App): void {
  app.command("/mystats", async ({ ack, command, respond, client }) => {
    await handleMystatsCommand({
      ack,
      command,
      respond,
      client: client as unknown as SlackUsersInfoClient,
    });
  });
}
