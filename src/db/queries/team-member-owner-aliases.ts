import { sql } from "../sql.js";

export interface TeamMemberOwnerAliasMatch {
  slackUserId: string;
  displayName: string;
}

interface TeamMemberOwnerAliasRow {
  slack_user_id: string;
  display_name: string;
}

export function normalizeOwnerAlias(value: string): string {
  return value.trim().toLowerCase();
}

export interface UpsertTeamMemberOwnerAliasInput {
  slackUserId: string;
  alias: string;
}

export async function upsertTeamMemberOwnerAlias(
  input: UpsertTeamMemberOwnerAliasInput,
): Promise<void> {
  await sql`
    insert into team_member_owner_aliases (
      slack_user_id,
      normalized_alias
    )
    values (
      ${input.slackUserId},
      ${normalizeOwnerAlias(input.alias)}
    )
    on conflict (normalized_alias) do update
    set
      slack_user_id = excluded.slack_user_id,
      updated_at = now()
  `;
}

export async function findActiveTeamMembersByOwnerAlias(
  alias: string,
): Promise<TeamMemberOwnerAliasMatch[]> {
  const normalizedAlias = normalizeOwnerAlias(alias);

  const rows = await sql<TeamMemberOwnerAliasRow[]>`
    select
      tm.slack_user_id,
      tm.display_name
    from team_member_owner_aliases tmoa
    inner join team_members tm
      on tm.slack_user_id = tmoa.slack_user_id
    where tmoa.normalized_alias = ${normalizedAlias}
      and tm.is_active = true
  `;

  return rows.map((row) => ({
    slackUserId: row.slack_user_id,
    displayName: row.display_name,
  }));
}
