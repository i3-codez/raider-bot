import { env } from "../config/env.js";
import {
  buildOpsSurfacingDigest,
  type BuildOpsSurfacingDigestDependencies,
} from "../domain/reminders/ops-surfacing.js";
import {
  recordOpsAlertPublication,
  type OpsAlertPublicationParams,
} from "../db/queries/job-runs.js";
import type { SlackPostingClient } from "../slack/client.js";

export interface PublishOpsSurfacingParams {
  dryRun?: boolean;
  now?: Date;
}

export interface PublishOpsSurfacingDependencies extends BuildOpsSurfacingDigestDependencies {
  client?: SlackPostingClient;
  recordOpsAlertPublication?: (
    params: OpsAlertPublicationParams,
  ) => Promise<void>;
  resolveChannelId?: () => string;
}

function resolveOpsChannelId(): string {
  return env.SLACK_OPS_CHANNEL_ID ?? env.SLACK_SUMMARY_CHANNEL_ID ?? env.SLACK_RAID_CHANNEL_ID;
}

export async function publishOpsSurfacing(
  params: PublishOpsSurfacingParams = {},
  dependencies: PublishOpsSurfacingDependencies = {},
) {
  const digest = await buildOpsSurfacingDigest(
    {
      now: params.now,
    },
    dependencies,
  );
  const dryRun = params.dryRun ?? false;
  const channelId = (dependencies.resolveChannelId ?? resolveOpsChannelId)();

  if (!dryRun && digest.alerts.length > 0) {
    if (!dependencies.client) {
      throw new Error("A Slack client is required when publishing live ops surfacing.");
    }

    await dependencies.client.chat.postMessage({
      channel: channelId,
      text: digest.text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: digest.text,
          },
        },
      ],
    });

    for (const alert of digest.alerts) {
      await (dependencies.recordOpsAlertPublication ?? recordOpsAlertPublication)({
        raidPostId: alert.raidPostId,
        alertType: alert.alertType,
        alertWindowKey: alert.alertWindowKey,
      });
    }
  }

  return {
    channelId,
    dryRun,
    digest,
  };
}
