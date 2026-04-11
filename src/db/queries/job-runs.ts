import type { DbTransaction } from "../sql.js";
import { sql } from "../sql.js";

type SqlExecutor = typeof sql | DbTransaction;

export interface JobRunRecord {
  jobName: string;
  windowKey: string;
  details: string;
  completedAt: Date;
}

interface JobRunRow {
  job_name: string;
  window_key: string;
  details: string;
  completed_at: Date | string;
}

export interface UpsertJobRunParams {
  jobName: string;
  windowKey: string;
  details?: string;
}

function mapJobRunRow(row: JobRunRow): JobRunRecord {
  return {
    jobName: row.job_name,
    windowKey: row.window_key,
    details: row.details,
    completedAt: row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at),
  };
}

export async function upsertJobRun(
  { jobName, windowKey, details = "" }: UpsertJobRunParams,
  executor: SqlExecutor = sql,
): Promise<JobRunRecord> {
  const rows = await executor<JobRunRow[]>`
    insert into job_runs (
      job_name,
      window_key,
      details
    )
    values (
      ${jobName},
      ${windowKey},
      ${details}
    )
    on conflict (job_name, window_key)
    do update set
      details = excluded.details,
      completed_at = now()
    returning
      job_name,
      window_key,
      details,
      completed_at
  `;

  return mapJobRunRow(rows[0]);
}

export interface OpsAlertPublicationParams {
  raidPostId: string;
  alertType: string;
  alertWindowKey: string;
}

export async function hasOpsAlertPublication(
  { raidPostId, alertType, alertWindowKey }: OpsAlertPublicationParams,
  executor: SqlExecutor = sql,
): Promise<boolean> {
  const rows = await executor<{ present: boolean }[]>`
    select true as present
    from ops_alert_publications
    where raid_post_id = ${raidPostId}
      and alert_type = ${alertType}
      and alert_window_key = ${alertWindowKey}
    limit 1
  `;

  return Boolean(rows[0]?.present);
}

export async function recordOpsAlertPublication(
  { raidPostId, alertType, alertWindowKey }: OpsAlertPublicationParams,
  executor: SqlExecutor = sql,
): Promise<void> {
  await executor`
    insert into ops_alert_publications (
      raid_post_id,
      alert_type,
      alert_window_key
    )
    values (
      ${raidPostId},
      ${alertType},
      ${alertWindowKey}
    )
    on conflict do nothing
  `;
}
