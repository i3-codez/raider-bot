import { sql } from "../sql.js";

export interface MonthlyLeaderboardEntry {
  slackUserId: string;
  displayName: string;
  totalPoints: number;
  uniqueRaidsEngaged: number;
  earlyWindowActions: number;
  totalActions: number;
}

export interface MemberMonthlyStats {
  slackUserId: string;
  displayName: string;
  totalPoints: number;
  uniqueRaidsEngaged: number;
  earlyWindowActions: number;
  totalActions: number;
}

interface MonthlyLeaderboardRow {
  slack_user_id: string;
  display_name: string;
  total_points: number;
  unique_raids_engaged: number;
  early_window_actions: number;
  total_actions: number;
}

function mapMonthlyLeaderboardRow(row: MonthlyLeaderboardRow): MonthlyLeaderboardEntry {
  return {
    slackUserId: row.slack_user_id,
    displayName: row.display_name,
    totalPoints: Number(row.total_points),
    uniqueRaidsEngaged: Number(row.unique_raids_engaged),
    earlyWindowActions: Number(row.early_window_actions),
    totalActions: Number(row.total_actions),
  };
}

export interface QueryMonthlyLeaderboardParams {
  monthKey: string;
  limit?: number;
}

export async function queryMonthlyLeaderboard(
  { monthKey, limit = 10 }: QueryMonthlyLeaderboardParams,
  executor: typeof sql = sql,
): Promise<MonthlyLeaderboardEntry[]> {
  const rows = await executor<MonthlyLeaderboardRow[]>`
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
    where rp.month_key = ${monthKey}
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

  return rows.map(mapMonthlyLeaderboardRow);
}

export interface QueryMemberMonthlyStatsParams {
  slackUserId: string;
  monthKey: string;
}

export async function queryMemberMonthlyStats(
  { slackUserId, monthKey }: QueryMemberMonthlyStatsParams,
  executor: typeof sql = sql,
): Promise<MemberMonthlyStats | null> {
  const rows = await executor<MonthlyLeaderboardRow[]>`
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
    where rp.month_key = ${monthKey}
      and el.slack_user_id = ${slackUserId}
      and el.removed_at is null
    group by
      el.slack_user_id,
      coalesce(tm.display_name, el.slack_user_id)
    limit 1
  `;

  const row = rows[0];
  return row ? mapMonthlyLeaderboardRow(row) : null;
}
