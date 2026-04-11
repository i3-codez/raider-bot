import { sql } from "../sql.js";

export interface SummaryLeaderboardEntry {
  slackUserId: string;
  displayName: string;
  totalPoints: number;
  uniqueRaidsEngaged: number;
  earlyWindowActions: number;
  totalActions: number;
  earlyWindowActionRate: number;
}

export interface SummaryTotals {
  totalPoints: number;
  uniqueRaidsEngaged: number;
  earlyWindowActions: number;
  totalActions: number;
  earlyWindowActionRate: number;
}

interface SummaryLeaderboardRow {
  slack_user_id: string;
  display_name: string;
  total_points: number;
  unique_raids_engaged: number;
  early_window_actions: number;
  total_actions: number;
}

interface SummaryTotalsRow {
  total_points: number;
  unique_raids_engaged: number;
  early_window_actions: number;
  total_actions: number;
}

export interface QuerySummaryReportParams {
  windowStart: Date;
  windowEnd: Date;
  limit?: number;
}

function toRate(earlyWindowActions: number, totalActions: number): number {
  if (totalActions <= 0) {
    return 0;
  }

  return Number((earlyWindowActions / totalActions).toFixed(4));
}

function mapLeaderboardRow(row: SummaryLeaderboardRow): SummaryLeaderboardEntry {
  const earlyWindowActions = Number(row.early_window_actions);
  const totalActions = Number(row.total_actions);

  return {
    slackUserId: row.slack_user_id,
    displayName: row.display_name,
    totalPoints: Number(row.total_points),
    uniqueRaidsEngaged: Number(row.unique_raids_engaged),
    earlyWindowActions,
    totalActions,
    earlyWindowActionRate: toRate(earlyWindowActions, totalActions),
  };
}

function mapTotalsRow(row: SummaryTotalsRow | undefined): SummaryTotals {
  const earlyWindowActions = Number(row?.early_window_actions ?? 0);
  const totalActions = Number(row?.total_actions ?? 0);

  return {
    totalPoints: Number(row?.total_points ?? 0),
    uniqueRaidsEngaged: Number(row?.unique_raids_engaged ?? 0),
    earlyWindowActions,
    totalActions,
    earlyWindowActionRate: toRate(earlyWindowActions, totalActions),
  };
}

export async function querySummaryLeaderboard(
  { windowStart, windowEnd, limit = 5 }: QuerySummaryReportParams,
  executor: typeof sql = sql,
): Promise<SummaryLeaderboardEntry[]> {
  const rows = await executor<SummaryLeaderboardRow[]>`
    select
      el.slack_user_id,
      coalesce(tm.display_name, el.slack_user_id) as display_name,
      coalesce(sum(el.points_awarded), 0) as total_points,
      count(distinct el.raid_post_id) as unique_raids_engaged,
      count(*) filter (
        where el.scoring_window in ('0-10m', '10-20m', '20-30m')
      ) as early_window_actions,
      count(*) as total_actions
    from engagement_logs el
    inner join raid_posts rp
      on rp.id = el.raid_post_id
    left join team_members tm
      on tm.slack_user_id = el.slack_user_id
      and tm.is_active = true
    where coalesce(rp.published_at, rp.slack_posted_at) >= ${windowStart}
      and coalesce(rp.published_at, rp.slack_posted_at) < ${windowEnd}
      and el.removed_at is null
    group by
      el.slack_user_id,
      coalesce(tm.display_name, el.slack_user_id)
    order by
      total_points desc,
      early_window_actions desc,
      display_name asc
    limit ${limit}
  `;

  return rows.map(mapLeaderboardRow);
}

export async function querySummaryTotals(
  { windowStart, windowEnd }: QuerySummaryReportParams,
  executor: typeof sql = sql,
): Promise<SummaryTotals> {
  const rows = await executor<SummaryTotalsRow[]>`
    select
      coalesce(sum(el.points_awarded), 0) as total_points,
      count(distinct el.raid_post_id) as unique_raids_engaged,
      count(*) filter (
        where el.scoring_window in ('0-10m', '10-20m', '20-30m')
      ) as early_window_actions,
      count(*) as total_actions
    from engagement_logs el
    inner join raid_posts rp
      on rp.id = el.raid_post_id
    where coalesce(rp.published_at, rp.slack_posted_at) >= ${windowStart}
      and coalesce(rp.published_at, rp.slack_posted_at) < ${windowEnd}
      and el.removed_at is null
  `;

  return mapTotalsRow(rows[0]);
}
