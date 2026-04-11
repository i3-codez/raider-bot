import type {
  EngagementScoreUpdate,
  RaidPostRecord,
} from "../../domain/raids/correct-raid-published-at.js";
import type { Platform, RaidTimingConfidence } from "../../domain/raids/types.js";
import type { DbTransaction } from "../sql.js";

interface UpdatedRaidRow {
  id: string;
  client_name: string;
  platform: string;
  post_url: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  slack_channel_id: string;
  slack_message_ts: string;
  timing_confidence: string;
  month_key: string;
}

export interface UpdateRaidPublishedAtParams {
  executor: DbTransaction;
  raidPostId: string;
  publishedAt: Date;
  monthKey: string;
  engagementUpdates: EngagementScoreUpdate[];
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRaidRow(row: UpdatedRaidRow): RaidPostRecord {
  return {
    id: row.id,
    clientName: row.client_name,
    platform: row.platform as Platform,
    postUrl: row.post_url,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    slackChannelId: row.slack_channel_id,
    slackMessageTs: row.slack_message_ts,
    timingConfidence: row.timing_confidence as RaidTimingConfidence,
    monthKey: row.month_key,
  };
}

export async function updateRaidPublishedAt({
  executor,
  raidPostId,
  publishedAt,
  monthKey,
  engagementUpdates,
}: UpdateRaidPublishedAtParams): Promise<RaidPostRecord> {
  const rows = await executor<UpdatedRaidRow[]>`
    update raid_posts
    set
      published_at = ${publishedAt},
      timing_confidence = ${"high"},
      month_key = ${monthKey}
    where id = ${raidPostId}
    returning
      id,
      client_name,
      platform,
      post_url,
      published_at,
      slack_posted_at,
      slack_channel_id,
      slack_message_ts,
      timing_confidence,
      month_key
  `;

  const updatedRaid = rows[0];

  if (!updatedRaid) {
    throw new Error(`Raid post ${raidPostId} could not be updated.`);
  }

  for (const engagement of engagementUpdates) {
    await executor`
      update engagement_logs
      set
        minutes_from_publish = ${engagement.minutesFromPublish},
        scoring_window = ${engagement.scoringWindow},
        points_awarded = ${engagement.pointsAwarded}
      where id = ${engagement.id}
        and raid_post_id = ${raidPostId}
    `;
  }

  return mapRaidRow(updatedRaid);
}
