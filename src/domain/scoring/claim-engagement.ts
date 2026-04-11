import type { ActionType } from "./types.js";

import type { RaidSlackRefRecord } from "../../db/queries/find-raid-by-slack-ref.js";

export interface EngagementMutationInput {
  raid: RaidSlackRefRecord;
  slackUserId: string;
  slackReaction: string;
  actionType: ActionType;
  eventTime: Date;
}

export async function claimEngagement(_input: EngagementMutationInput): Promise<void> {}
