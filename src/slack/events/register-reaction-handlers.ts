import type { App } from "@slack/bolt";

import { findRaidBySlackRef } from "../../db/queries/find-raid-by-slack-ref.js";
import { ACTION_REGISTRY } from "../../domain/scoring/action-registry.js";
import { claimEngagement } from "../../domain/scoring/claim-engagement.js";
import { reverseEngagement } from "../../domain/scoring/reverse-engagement.js";

const ACTION_DEFINITIONS_BY_EMOJI = new Map<string, (typeof ACTION_REGISTRY)[number]>(
  ACTION_REGISTRY.map((definition) => [definition.emoji, definition]),
);

function parseSlackEventTime(eventTs: string): Date {
  return new Date(Number(eventTs) * 1000);
}

export function registerReactionHandlers(app: App): void {
  app.event("reaction_added", async ({ event, context }) => {
    if (event.item.type !== "message") {
      return;
    }

    if (context?.botUserId && event.user === context.botUserId) {
      return;
    }

    const actionDefinition = ACTION_DEFINITIONS_BY_EMOJI.get(event.reaction);

    if (!actionDefinition) {
      return;
    }

    const raid = await findRaidBySlackRef({
      slackChannelId: event.item.channel,
      slackMessageTs: event.item.ts,
    });

    if (!raid) {
      return;
    }

    await claimEngagement({
      raid,
      slackUserId: event.user,
      slackReaction: event.reaction,
      actionType: actionDefinition.actionType,
      eventTime: parseSlackEventTime(event.event_ts),
    });
  });

  app.event("reaction_removed", async ({ event, context }) => {
    if (event.item.type !== "message") {
      return;
    }

    if (context?.botUserId && event.user === context.botUserId) {
      return;
    }

    const actionDefinition = ACTION_DEFINITIONS_BY_EMOJI.get(event.reaction);

    if (!actionDefinition) {
      return;
    }

    const raid = await findRaidBySlackRef({
      slackChannelId: event.item.channel,
      slackMessageTs: event.item.ts,
    });

    if (!raid) {
      return;
    }

    await reverseEngagement({
      raid,
      slackUserId: event.user,
      slackReaction: event.reaction,
      actionType: actionDefinition.actionType,
      eventTime: parseSlackEventTime(event.event_ts),
    });
  });
}
