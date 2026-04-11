import { sql } from "../sql.js";
import type { Platform, RaidPost, RaidTimingConfidence } from "../../domain/raids/types.js";

interface FindRaidByDedupeKeyParams {
  platform: Platform;
  postUrl: string;
  sourceEventId?: string | null;
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

export function normalizePostUrl(postUrl: string): string {
  try {
    const url = new URL(postUrl);
    url.hash = "";
    url.search = "";

    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${normalizedPath}`.toLowerCase();
  } catch {
    return postUrl.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

async function findBySourceEventId(sourceEventId: string): Promise<RaidPost | null> {
  const rows = await sql<RaidPostRow[]>`
    select
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
    from raid_posts
    where source_event_id = ${sourceEventId}
    limit 1
  `;

  const row = rows[0];
  return row ? mapRaidPostRow(row) : null;
}

async function findByNormalizedPostUrl(platform: Platform, normalizedPostUrl: string): Promise<RaidPost | null> {
  const rows = await sql<RaidPostRow[]>`
    select
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
    from raid_posts
    where platform = ${platform}
      and normalized_post_url = ${normalizedPostUrl}
    limit 1
  `;

  const row = rows[0];
  return row ? mapRaidPostRow(row) : null;
}

export async function findRaidByDedupeKey({
  platform,
  postUrl,
  sourceEventId,
}: FindRaidByDedupeKeyParams): Promise<RaidPost | null> {
  if (sourceEventId) {
    const byEventId = await findBySourceEventId(sourceEventId);

    if (byEventId) {
      return byEventId;
    }
  }

  return findByNormalizedPostUrl(platform, normalizePostUrl(postUrl));
}
