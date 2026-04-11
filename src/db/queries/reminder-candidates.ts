import { sql } from "../sql.js";

export interface ReminderCandidate {
  raidPostId: string;
  clientName: string;
  platform: string;
  postUrl: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
  timingConfidence: "high" | "low";
  earlyWindowActions: number;
}

interface ReminderCandidateRow {
  raid_post_id: string;
  client_name: string;
  platform: string;
  post_url: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  timing_confidence: "high" | "low";
  early_window_actions: number;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapReminderCandidateRow(row: ReminderCandidateRow): ReminderCandidate {
  return {
    raidPostId: row.raid_post_id,
    clientName: row.client_name,
    platform: row.platform,
    postUrl: row.post_url,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    timingConfidence: row.timing_confidence,
    earlyWindowActions: Number(row.early_window_actions),
  };
}

export interface QueryReminderCandidatesParams {
  lookbackStart: Date;
  now: Date;
}

export async function queryReminderCandidates(
  { lookbackStart, now }: QueryReminderCandidatesParams,
  executor: typeof sql = sql,
): Promise<ReminderCandidate[]> {
  const rows = await executor<ReminderCandidateRow[]>`
    select
      rp.id as raid_post_id,
      rp.client_name,
      rp.platform,
      rp.post_url,
      rp.published_at,
      rp.slack_posted_at,
      rp.timing_confidence,
      count(el.id) filter (
        where el.removed_at is null
          and el.scoring_window in ('0-10m', '10-20m', '20-30m')
      ) as early_window_actions
    from raid_posts rp
    left join engagement_logs el
      on el.raid_post_id = rp.id
    where coalesce(rp.published_at, rp.slack_posted_at) >= ${lookbackStart}
      and coalesce(rp.published_at, rp.slack_posted_at) < ${now}
    group by
      rp.id,
      rp.client_name,
      rp.platform,
      rp.post_url,
      rp.published_at,
      rp.slack_posted_at,
      rp.timing_confidence
    order by coalesce(rp.published_at, rp.slack_posted_at) asc
  `;

  return rows.map(mapReminderCandidateRow);
}
