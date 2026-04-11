import type { ActionType } from "./types.js";

import type { RaidSlackRefRecord } from "../../db/queries/find-raid-by-slack-ref.js";
import { claimEngagementLog } from "../../db/queries/engagement-logs.js";
import { minutesBetween } from "../../lib/time.js";
import { SCORING_WINDOWS } from "./scoring-config.js";

export interface EngagementMutationInput {
  raid: RaidSlackRefRecord;
  slackUserId: string;
  slackReaction: string;
  actionType: ActionType;
  eventTime: Date;
}

function resolveScoringWindow(minutesFromPublish: number) {
  return (
    SCORING_WINDOWS.find(
      ({ minMinutes, maxMinutesExclusive }) =>
        minutesFromPublish >= minMinutes &&
        (maxMinutesExclusive === null || minutesFromPublish < maxMinutesExclusive),
    ) ?? SCORING_WINDOWS[SCORING_WINDOWS.length - 1]
  );
}

export async function claimEngagement(input: EngagementMutationInput): Promise<void> {
  const referenceTime = input.raid.publishedAt ?? input.raid.slackPostedAt;
  const minutesFromPublish = Math.max(minutesBetween(input.eventTime, referenceTime), 0);
  const scoringWindow = resolveScoringWindow(minutesFromPublish);

  await claimEngagementLog({
    raidPostId: input.raid.id,
    slackUserId: input.slackUserId,
    slackReaction: input.slackReaction,
    actionType: input.actionType,
    reactedAt: input.eventTime,
    minutesFromPublish,
    scoringWindow: scoringWindow.label,
    pointsAwarded: scoringWindow.points,
  });
}
