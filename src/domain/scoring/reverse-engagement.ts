import type { EngagementMutationInput } from "./claim-engagement.js";
import { reverseEngagementLog } from "../../db/queries/engagement-logs.js";

export async function reverseEngagement(input: EngagementMutationInput): Promise<void> {
  await reverseEngagementLog({
    raidPostId: input.raid.id,
    slackUserId: input.slackUserId,
    actionType: input.actionType,
    removedAt: input.eventTime,
  });
}
