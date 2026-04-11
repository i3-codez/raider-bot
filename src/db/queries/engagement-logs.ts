import type { ActionType, ScoringWindowLabel } from "../../domain/scoring/types.js";
import { sql } from "../sql.js";

export interface ClaimEngagementLogParams {
  raidPostId: string;
  slackUserId: string;
  slackReaction: string;
  actionType: ActionType;
  reactedAt: Date;
  minutesFromPublish: number;
  scoringWindow: ScoringWindowLabel;
  pointsAwarded: number;
}

export interface ReverseEngagementLogParams {
  raidPostId: string;
  slackUserId: string;
  actionType: ActionType;
  removedAt: Date;
}

export async function claimEngagementLog({
  raidPostId,
  slackUserId,
  slackReaction,
  actionType,
  reactedAt,
  minutesFromPublish,
  scoringWindow,
  pointsAwarded,
}: ClaimEngagementLogParams): Promise<void> {
  await sql`
    insert into engagement_logs (
      raid_post_id,
      slack_user_id,
      slack_reaction,
      action_type,
      reacted_at,
      minutes_from_publish,
      scoring_window,
      points_awarded
    )
    values (
      ${raidPostId},
      ${slackUserId},
      ${slackReaction},
      ${actionType},
      ${reactedAt},
      ${minutesFromPublish},
      ${scoringWindow},
      ${pointsAwarded}
    )
    ON CONFLICT (raid_post_id, slack_user_id, action_type) DO UPDATE SET
      slack_reaction = EXCLUDED.slack_reaction,
      reacted_at = EXCLUDED.reacted_at,
      minutes_from_publish = EXCLUDED.minutes_from_publish,
      scoring_window = EXCLUDED.scoring_window,
      points_awarded = EXCLUDED.points_awarded,
      removed_at = NULL,
      updated_at = NOW()
    WHERE engagement_logs.removed_at IS NOT NULL;
  `;
}

export async function reverseEngagementLog({
  raidPostId,
  slackUserId,
  actionType,
  removedAt,
}: ReverseEngagementLogParams): Promise<void> {
  await sql`
    update engagement_logs
    set removed_at = ${removedAt}
    where raid_post_id = ${raidPostId}
      and slack_user_id = ${slackUserId}
      and action_type = ${actionType}
      and removed_at is null
  `;
}
