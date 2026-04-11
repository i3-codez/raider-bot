import { env } from "../../config/env.js";
import { insertRaidPost, type InsertRaidPostInput } from "../../db/queries/insert-raid-post.js";
import { deriveMonthKey } from "../../lib/time.js";
import { buildRaidMessage } from "../../slack/blocks/build-raid-message.js";
import type { ManualRaidInput } from "./manual-raid-input.js";
import type { RaidPost } from "./types.js";

interface ChatPostMessagePayload {
  channel: string;
  text: string;
  blocks: unknown[];
}

interface ChatPostMessageResponse {
  channel?: string;
  ts?: string;
}

export interface SlackClientLike {
  chat: {
    postMessage(payload: ChatPostMessagePayload): Promise<ChatPostMessageResponse>;
  };
}

export interface CreateManualRaidInput extends ManualRaidInput {
  createdBySlackUserId: string;
}

export interface CreateManualRaidContext {
  client: SlackClientLike;
  now?: () => Date;
  insertRaidPost?: (input: InsertRaidPostInput) => Promise<RaidPost>;
}

export async function createManualRaid(
  input: CreateManualRaidInput,
  context: CreateManualRaidContext,
): Promise<RaidPost> {
  const slackPostedAt = context.now ? context.now() : new Date();
  const timingConfidence = input.publishedAt ? "high" : "low";
  const referenceTime = input.publishedAt ?? slackPostedAt;
  const monthKey = deriveMonthKey(referenceTime);
  const message = buildRaidMessage({
    clientName: input.clientName,
    platform: input.platform,
    postUrl: input.postUrl,
    timingConfidence,
    referenceTime,
  });
  const response = await context.client.chat.postMessage({
    channel: env.SLACK_RAID_CHANNEL_ID,
    text: message.text,
    blocks: message.blocks,
  });
  const slackMessageTs = response.ts;
  const slackChannelId = response.channel;

  if (!slackMessageTs || !slackChannelId) {
    throw new Error("Slack did not return channel or message identifiers for the new raid.");
  }

  return (context.insertRaidPost ?? insertRaidPost)({
    postUrl: input.postUrl,
    clientName: input.clientName,
    platform: input.platform,
    createdBySlackUserId: input.createdBySlackUserId,
    publishedAt: input.publishedAt,
    slackPostedAt,
    slackMessageTs,
    slackChannelId,
    timingConfidence,
    monthKey,
  });
}
