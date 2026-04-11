import type { App } from "@slack/bolt";

import {
  getMemberMonthlyStats,
  type GetMemberMonthlyStatsDependencies,
} from "../../domain/reporting/monthly-reporting.js";

interface ChatPostMessagePayload {
  channel: string;
  text: string;
}

interface ConversationsOpenPayload {
  users: string;
}

interface ConversationsOpenResponse {
  channel?: {
    id?: string;
  };
}

export interface HandleMystatsCommandArgs {
  ack(): Promise<void>;
  command: {
    user_id: string;
  };
  respond(payload: {
    response_type: "ephemeral";
    text: string;
  }): Promise<unknown>;
  client: {
    conversations: {
      open(payload: ConversationsOpenPayload): Promise<ConversationsOpenResponse>;
    };
    chat: {
      postMessage(payload: ChatPostMessagePayload): Promise<unknown>;
    };
  };
}

export interface HandleMystatsCommandDependencies extends GetMemberMonthlyStatsDependencies {}

function buildStatsText(stats: Awaited<ReturnType<typeof getMemberMonthlyStats>>, slackUserId: string) {
  if (!stats) {
    return `No tracked activity yet this month for ${slackUserId}.`;
  }

  return [
    `${stats.displayName} this month:`,
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

  const dm = await args.client.conversations.open({
    users: args.command.user_id,
  });
  const channelId = dm.channel?.id;

  if (!channelId) {
    throw new Error("Slack did not return a DM channel id for /mystats.");
  }

  await args.client.chat.postMessage({
    channel: channelId,
    text: buildStatsText(stats, args.command.user_id),
  });

  await args.respond({
    response_type: "ephemeral",
    text: "Sent your current-month stats by DM.",
  });
}

export function registerMystatsCommand(app: App): void {
  app.command("/mystats", async ({ ack, command, respond, client }) => {
    await handleMystatsCommand({
      ack,
      command,
      respond,
      client,
    });
  });
}
