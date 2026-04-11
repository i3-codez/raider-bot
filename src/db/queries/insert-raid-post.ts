import { sql } from "../sql.js";
import type { Platform, RaidPost, RaidTimingConfidence } from "../../domain/raids/types.js";

export interface InsertRaidPostInput {
  postUrl: string;
  clientName: string;
  platform: Platform;
  createdBySlackUserId: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
  slackMessageTs: string;
  slackChannelId: string;
  timingConfidence: RaidTimingConfidence;
  monthKey: string;
}

interface RaidPostRow {
  id: string;
  post_url: string;
  client_name: string;
  platform: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  slack_message_ts: string;
  slack_channel_id: string;
  timing_confidence: string;
  month_key: string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRaidPostRow(row: RaidPostRow): RaidPost {
  return {
    id: row.id,
    postUrl: row.post_url,
    clientName: row.client_name,
    platform: row.platform as Platform,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    slackMessageTs: row.slack_message_ts,
    slackChannelId: row.slack_channel_id,
    timingConfidence: row.timing_confidence as RaidTimingConfidence,
    monthKey: row.month_key,
  };
}

export async function insertRaidPost(
  input: InsertRaidPostInput,
  executor: typeof sql = sql,
): Promise<RaidPost> {
  const rows = await executor<RaidPostRow[]>`
    insert into raid_posts (
      post_url,
      client_name,
      platform,
      created_by_slack_user_id,
      published_at,
      slack_posted_at,
      slack_message_ts,
      slack_channel_id,
      timing_confidence,
      month_key
    )
    values (
      ${input.postUrl},
      ${input.clientName},
      ${input.platform},
      ${input.createdBySlackUserId},
      ${input.publishedAt},
      ${input.slackPostedAt},
      ${input.slackMessageTs},
      ${input.slackChannelId},
      ${input.timingConfidence},
      ${input.monthKey}
    )
    returning
      id,
      post_url,
      client_name,
      platform,
      published_at,
      slack_posted_at,
      slack_message_ts,
      slack_channel_id,
      timing_confidence,
      month_key
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert raid post.");
  }

  return mapRaidPostRow(row);
}
