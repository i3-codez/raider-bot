import { sql } from "../sql.js";

interface FindRaidBySlackRefParams {
  slackChannelId: string;
  slackMessageTs: string;
}

interface RaidSlackRefRow {
  id: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
}

export interface RaidSlackRefRecord {
  id: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
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
      slack_posted_at
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
  };
}
