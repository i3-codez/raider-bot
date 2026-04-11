import { sql } from "../sql.js";
import type {
  Platform,
  RaidOwnerMetadata,
  RaidPost,
  RaidTimingConfidence,
} from "../../domain/raids/types.js";

export interface InsertRaidPostInput extends RaidOwnerMetadata {
  postUrl: string;
  normalizedPostUrl: string;
  clientName: string;
  platform: Platform;
  createdBySlackUserId: string;
  sourceEventId?: string | null;
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
  normalized_post_url: string;
  client_name: string;
  platform: string;
  source_event_id: string | null;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  slack_message_ts: string;
  slack_channel_id: string;
  timing_confidence: string;
  month_key: string;
  owner_external_id: string | null;
  owner_display_name: string | null;
  owner_slack_user_id: string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRaidPostRow(row: RaidPostRow): RaidPost {
  return {
    id: row.id,
    postUrl: row.post_url,
    normalizedPostUrl: row.normalized_post_url,
    clientName: row.client_name,
    platform: row.platform as Platform,
    sourceEventId: row.source_event_id,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    slackMessageTs: row.slack_message_ts,
    slackChannelId: row.slack_channel_id,
    timingConfidence: row.timing_confidence as RaidTimingConfidence,
    monthKey: row.month_key,
    ownerExternalId: row.owner_external_id,
    ownerDisplayName: row.owner_display_name,
    ownerSlackUserId: row.owner_slack_user_id,
  };
}

export async function insertRaidPost(
  input: InsertRaidPostInput,
  executor: typeof sql = sql,
): Promise<RaidPost> {
  const rows = await executor<RaidPostRow[]>`
    insert into raid_posts (
      post_url,
      normalized_post_url,
      client_name,
      platform,
      created_by_slack_user_id,
      source_event_id,
      published_at,
      slack_posted_at,
      slack_message_ts,
      slack_channel_id,
      timing_confidence,
      month_key,
      owner_external_id,
      owner_display_name,
      owner_slack_user_id
    )
    values (
      ${input.postUrl},
      ${input.normalizedPostUrl},
      ${input.clientName},
      ${input.platform},
      ${input.createdBySlackUserId},
      ${input.sourceEventId ?? null},
      ${input.publishedAt},
      ${input.slackPostedAt},
      ${input.slackMessageTs},
      ${input.slackChannelId},
      ${input.timingConfidence},
      ${input.monthKey},
      ${input.ownerExternalId ?? null},
      ${input.ownerDisplayName ?? null},
      ${input.ownerSlackUserId ?? null}
    )
    returning
      id,
      post_url,
      normalized_post_url,
      client_name,
      platform,
      source_event_id,
      published_at,
      slack_posted_at,
      slack_message_ts,
      slack_channel_id,
      timing_confidence,
      month_key,
      owner_external_id,
      owner_display_name,
      owner_slack_user_id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert raid post.");
  }

  return mapRaidPostRow(row);
}

export interface UpdateRaidPostWebhookMetadataInput extends RaidOwnerMetadata {
  raidPostId: string;
  normalizedPostUrl: string;
  sourceEventId?: string | null;
}

export async function updateRaidPostWebhookMetadata(
  input: UpdateRaidPostWebhookMetadataInput,
  executor: typeof sql = sql,
): Promise<RaidPost> {
  const rows = await executor<RaidPostRow[]>`
    update raid_posts
    set
      normalized_post_url = coalesce(${input.normalizedPostUrl}, normalized_post_url),
      source_event_id = coalesce(${input.sourceEventId ?? null}, source_event_id),
      owner_external_id = coalesce(${input.ownerExternalId ?? null}, owner_external_id),
      owner_display_name = coalesce(${input.ownerDisplayName ?? null}, owner_display_name),
      owner_slack_user_id = coalesce(${input.ownerSlackUserId ?? null}, owner_slack_user_id)
    where id = ${input.raidPostId}
    returning
      id,
      post_url,
      normalized_post_url,
      client_name,
      platform,
      source_event_id,
      published_at,
      slack_posted_at,
      slack_message_ts,
      slack_channel_id,
      timing_confidence,
      month_key,
      owner_external_id,
      owner_display_name,
      owner_slack_user_id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error(`Failed to update raid post ${input.raidPostId} webhook metadata.`);
  }

  return mapRaidPostRow(row);
}
