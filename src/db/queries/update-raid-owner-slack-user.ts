import { sql } from "../sql.js";

export interface UpdateRaidOwnerSlackUserInput {
  raidPostId: string;
  ownerSlackUserId: string;
}

export async function updateRaidOwnerSlackUser({
  raidPostId,
  ownerSlackUserId,
}: UpdateRaidOwnerSlackUserInput): Promise<void> {
  await sql`
    update raid_posts
    set
      owner_slack_user_id = ${ownerSlackUserId}
    where id = ${raidPostId}
      and owner_slack_user_id is null
  `;
}
