import type { DbTransaction } from "../sql.js";
import { sql, withTransaction } from "../sql.js";

type SqlExecutor = typeof sql | DbTransaction;

export interface MonthlySnapshotEntryInput {
  slackUserId: string;
  displayName: string;
  rank: number;
  totalPoints: number;
  uniqueRaidsEngaged: number;
  earlyWindowActions: number;
  totalActions: number;
  earlyWindowActionRate: number;
}

export interface ReplaceMonthlySnapshotsParams {
  monthKey: string;
  totals: {
    totalPoints: number;
    uniqueRaidsEngaged: number;
    earlyWindowActions: number;
    totalActions: number;
    earlyWindowActionRate: number;
  };
  entries: MonthlySnapshotEntryInput[];
}

async function writeSnapshots(
  params: ReplaceMonthlySnapshotsParams,
  executor: SqlExecutor,
): Promise<void> {
  await executor`
    insert into monthly_summary_snapshots (
      month_key,
      total_points,
      unique_raids_engaged,
      early_window_actions,
      total_actions,
      early_window_action_rate
    )
    values (
      ${params.monthKey},
      ${params.totals.totalPoints},
      ${params.totals.uniqueRaidsEngaged},
      ${params.totals.earlyWindowActions},
      ${params.totals.totalActions},
      ${params.totals.earlyWindowActionRate}
    )
    on conflict (month_key)
    do update set
      total_points = excluded.total_points,
      unique_raids_engaged = excluded.unique_raids_engaged,
      early_window_actions = excluded.early_window_actions,
      total_actions = excluded.total_actions,
      early_window_action_rate = excluded.early_window_action_rate,
      snapshot_at = now()
  `;

  await executor`
    delete from monthly_score_snapshots
    where month_key = ${params.monthKey}
  `;

  for (const entry of params.entries) {
    await executor`
      insert into monthly_score_snapshots (
        month_key,
        slack_user_id,
        display_name,
        rank,
        total_points,
        unique_raids_engaged,
        early_window_actions,
        total_actions,
        early_window_action_rate
      )
      values (
        ${params.monthKey},
        ${entry.slackUserId},
        ${entry.displayName},
        ${entry.rank},
        ${entry.totalPoints},
        ${entry.uniqueRaidsEngaged},
        ${entry.earlyWindowActions},
        ${entry.totalActions},
        ${entry.earlyWindowActionRate}
      )
      on conflict (month_key, slack_user_id)
      do update set
        display_name = excluded.display_name,
        rank = excluded.rank,
        total_points = excluded.total_points,
        unique_raids_engaged = excluded.unique_raids_engaged,
        early_window_actions = excluded.early_window_actions,
        total_actions = excluded.total_actions,
        early_window_action_rate = excluded.early_window_action_rate,
        snapshot_at = now()
    `;
  }
}

export async function replaceMonthlySnapshots(
  params: ReplaceMonthlySnapshotsParams,
  executor?: SqlExecutor,
): Promise<void> {
  if (executor) {
    await writeSnapshots(params, executor);
    return;
  }

  await withTransaction(async (transaction) => {
    await writeSnapshots(params, transaction);
  });
}
