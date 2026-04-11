import type { ActionType } from "./types.js";

import type { RaidSlackRefRecord } from "../../db/queries/find-raid-by-slack-ref.js";
import { claimEngagementLog } from "../../db/queries/engagement-logs.js";
import { updateRaidOwnerSlackUser } from "../../db/queries/update-raid-owner-slack-user.js";
import { resolvePostOwner } from "../roster/resolve-post-owner.js";
import { minutesBetween } from "../../lib/time.js";
import { SCORING_WINDOWS } from "./scoring-config.js";

export interface EngagementMutationInput {
  raid: RaidSlackRefRecord;
  slackUserId: string;
  slackReaction: string;
  actionType: ActionType;
  eventTime: Date;
}

export interface ClaimEngagementDependencies {
  claimEngagementLog?: typeof claimEngagementLog;
  resolvePostOwner?: typeof resolvePostOwner;
  updateRaidOwnerSlackUser?: typeof updateRaidOwnerSlackUser;
}

function isSelfRaidExclusionEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.RAIDER_EXCLUDE_SELF_RAIDS?.trim().toLowerCase() === "true";
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

async function resolveRaidOwnerSlackUserId(
  input: EngagementMutationInput,
  dependencies: ClaimEngagementDependencies,
): Promise<string | null> {
  if (input.raid.ownerSlackUserId) {
    return input.raid.ownerSlackUserId;
  }

  const resolvedOwner = await (dependencies.resolvePostOwner ?? resolvePostOwner)(
    {
      ownerExternalId: input.raid.ownerExternalId,
      ownerDisplayName: input.raid.ownerDisplayName,
    },
  );

  if (!resolvedOwner) {
    return null;
  }

  await (dependencies.updateRaidOwnerSlackUser ?? updateRaidOwnerSlackUser)({
    raidPostId: input.raid.id,
    ownerSlackUserId: resolvedOwner.slackUserId,
  });

  return resolvedOwner.slackUserId;
}

export async function claimEngagement(
  input: EngagementMutationInput,
  dependencies: ClaimEngagementDependencies = {},
): Promise<void> {
  const ownerSlackUserId = await resolveRaidOwnerSlackUserId(input, dependencies);

  if (isSelfRaidExclusionEnabled() && ownerSlackUserId === input.slackUserId) {
    return;
  }

  const referenceTime = input.raid.publishedAt ?? input.raid.slackPostedAt;
  const minutesFromPublish = Math.max(minutesBetween(input.eventTime, referenceTime), 0);
  const scoringWindow = resolveScoringWindow(minutesFromPublish);

  await (dependencies.claimEngagementLog ?? claimEngagementLog)({
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
