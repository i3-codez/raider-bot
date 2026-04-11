import { sql } from "../sql.js";

interface FindRaidBySlackRefParams {
  slackChannelId: string;
  slackMessageTs: string;
}

interface RaidSlackRefRow {
  id: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  owner_external_id: string | null;
  owner_display_name: string | null;
  owner_slack_user_id: string | null;
}

export interface RaidSlackRefRecord {
  id: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
  ownerExternalId: string | null;
  ownerDisplayName: string | null;
  ownerSlackUserId: string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function findRaidBySlackRef({
  slackChannelId,
  slackMessageTs,
}: FindRaidBySlackRefParams): Promise<RaidSlackRefRecord | null> {
  const rows = await sql<RaidSlackRefRow[]>`
    select
      id,
      published_at,
      slack_posted_at,
      owner_external_id,
      owner_display_name,
      owner_slack_user_id
    from raid_posts
    where slack_channel_id = ${slackChannelId}
      and slack_message_ts = ${slackMessageTs}
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    ownerExternalId: row.owner_external_id,
    ownerDisplayName: row.owner_display_name,
    ownerSlackUserId: row.owner_slack_user_id,
  };
}
