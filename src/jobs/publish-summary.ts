import { env } from "../config/env.js";
import {
  getSummaryReport,
  type GetSummaryReportDependencies,
} from "../domain/reporting/summary-reporting.js";
import { buildSummaryMessage } from "../slack/blocks/build-summary-message.js";
import type { SlackPostingClient } from "../slack/client.js";
import type { SummaryCadence } from "../lib/time.js";

export interface PublishSummaryJobParams {
  cadence: SummaryCadence;
  dryRun?: boolean;
  now?: Date;
  limit?: number;
}

export interface PublishSummaryJobDependencies extends GetSummaryReportDependencies {
  client?: SlackPostingClient;
  resolveChannelId?: () => string;
}

export interface PublishSummaryJobResult {
  channelId: string;
  dryRun: boolean;
  payload: ReturnType<typeof buildSummaryMessage>;
  report: Awaited<ReturnType<typeof getSummaryReport>>;
}

function resolveSummaryChannelId(): string {
  return env.SLACK_SUMMARY_CHANNEL_ID ?? env.SLACK_RAID_CHANNEL_ID;
}

export async function publishSummaryJob(
  params: PublishSummaryJobParams,
  dependencies: PublishSummaryJobDependencies = {},
): Promise<PublishSummaryJobResult> {
  const report = await getSummaryReport(
    {
      cadence: params.cadence,
      now: params.now,
      limit: params.limit,
    },
    dependencies,
  );
  const payload = buildSummaryMessage(report);
  const channelId = (dependencies.resolveChannelId ?? resolveSummaryChannelId)();
  const dryRun = params.dryRun ?? false;

  if (!dryRun) {
    if (!dependencies.client) {
      throw new Error("A Slack client is required when publishing a live summary job.");
    }

    await dependencies.client.chat.postMessage({
      channel: channelId,
      text: payload.text,
      blocks: payload.blocks,
    });
  }

  return {
    channelId,
    dryRun,
    payload,
    report,
  };
}
