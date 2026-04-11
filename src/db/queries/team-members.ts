import { sql } from "../sql.js";

export interface TeamMember {
  slackUserId: string;
  displayName: string;
  isActive: boolean;
}

interface TeamMemberRow {
  slack_user_id: string;
  display_name: string;
  is_active: boolean;
}

function mapTeamMemberRow(row: TeamMemberRow): TeamMember {
  return {
    slackUserId: row.slack_user_id,
    displayName: row.display_name,
    isActive: row.is_active,
  };
}

export interface UpsertTeamMemberInput {
  slackUserId: string;
  displayName: string;
  isActive?: boolean;
}

export async function upsertTeamMember(input: UpsertTeamMemberInput): Promise<TeamMember> {
  const rows = await sql<TeamMemberRow[]>`
    insert into team_members (
      slack_user_id,
      display_name,
      is_active
    )
    values (
      ${input.slackUserId},
      ${input.displayName},
      ${input.isActive ?? true}
    )
    on conflict (slack_user_id) do update
    set
      display_name = excluded.display_name,
      is_active = excluded.is_active,
      updated_at = now()
    returning
      slack_user_id,
      display_name,
      is_active
  `;

  const row = rows[0];

  if (!row) {
    throw new Error(`Failed to upsert team member ${input.slackUserId}.`);
  }

  return mapTeamMemberRow(row);
}

export async function findTeamMemberBySlackUserId(slackUserId: string): Promise<TeamMember | null> {
  const rows = await sql<TeamMemberRow[]>`
    select
      slack_user_id,
      display_name,
      is_active
    from team_members
    where slack_user_id = ${slackUserId}
    limit 1
  `;

  const row = rows[0];
  return row ? mapTeamMemberRow(row) : null;
}
