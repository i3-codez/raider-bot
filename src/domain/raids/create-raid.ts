import { env } from "../../config/env.js";
import { getSql } from "../../db/sql.js";
import { findRaidByDedupeKey, normalizePostUrl } from "../../db/queries/find-raid-by-dedupe-key.js";
import {
  insertRaidPost,
  type InsertRaidPostInput,
  updateRaidPostWebhookMetadata,
} from "../../db/queries/insert-raid-post.js";
import { deriveMonthKey } from "../../lib/time.js";
import { buildRaidMessage } from "../../slack/blocks/build-raid-message.js";
import { correctRaidPublishedAt } from "./correct-raid-published-at.js";
import type { Platform, RaidOwnerMetadata, RaidPost } from "./types.js";

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
    update?(payload: {
      channel: string;
      ts: string;
      text: string;
      blocks: unknown[];
    }): Promise<unknown>;
  };
}

export interface CreateRaidInput extends RaidOwnerMetadata {
  postUrl: string;
  clientName: string;
  platform: Platform;
  createdBySlackUserId: string;
  publishedAt: Date | null;
  sourceEventId?: string | null;
}

export type DedupeLockRunner = <T>(dedupeKey: string, callback: () => Promise<T>) => Promise<T>;

export interface CreateRaidContext {
  client: SlackClientLike;
  now?: () => Date;
  insertRaidPost?: (input: InsertRaidPostInput) => Promise<RaidPost>;
  findRaidByDedupeKey?: typeof findRaidByDedupeKey;
  correctRaidPublishedAt?: typeof correctRaidPublishedAt;
  withDedupeLock?: DedupeLockRunner;
}

async function defaultWithDedupeLock<T>(
  dedupeKey: string,
  callback: () => Promise<T>,
): Promise<T> {
  return getSql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${dedupeKey}, 0))`;
    return callback();
  }) as Promise<T>;
}

function buildDedupeKey(platform: Platform, postUrl: string): string {
  return `raid:${platform}:${normalizePostUrl(postUrl)}`;
}

function buildInsertInput(
  input: CreateRaidInput,
  context: CreateRaidContext,
  slackPostedAt: Date,
  response: ChatPostMessageResponse,
): InsertRaidPostInput {
  const slackMessageTs = response.ts;
  const slackChannelId = response.channel;

  if (!slackMessageTs || !slackChannelId) {
    throw new Error("Slack did not return channel or message identifiers for the new raid.");
  }

  const timingConfidence = input.publishedAt ? "high" : "low";
  const referenceTime = input.publishedAt ?? slackPostedAt;

  return {
    postUrl: input.postUrl,
    normalizedPostUrl: normalizePostUrl(input.postUrl),
    clientName: input.clientName,
    platform: input.platform,
    createdBySlackUserId: input.createdBySlackUserId,
    sourceEventId: input.sourceEventId ?? null,
    publishedAt: input.publishedAt,
    slackPostedAt,
    slackMessageTs,
    slackChannelId,
    timingConfidence,
    monthKey: deriveMonthKey(referenceTime),
    ownerExternalId: input.ownerExternalId ?? null,
    ownerDisplayName: input.ownerDisplayName ?? null,
    ownerSlackUserId: input.ownerSlackUserId ?? null,
  };
}

function buildSlackMessage(input: CreateRaidInput, slackPostedAt: Date) {
  const referenceTime = input.publishedAt ?? slackPostedAt;
  const timingConfidence = input.publishedAt ? "high" : "low";

  return buildRaidMessage({
    clientName: input.clientName,
    platform: input.platform,
    postUrl: input.postUrl,
    timingConfidence,
    referenceTime,
  });
}

function shouldApplyWebhookMetadata(input: CreateRaidInput): boolean {
  return Boolean(
    input.sourceEventId ??
      input.ownerExternalId ??
      input.ownerDisplayName ??
      input.ownerSlackUserId,
  );
}

function mergeRaidMetadata(raid: RaidPost, input: CreateRaidInput): RaidPost {
  return {
    ...raid,
    normalizedPostUrl: raid.normalizedPostUrl ?? normalizePostUrl(input.postUrl),
    sourceEventId: raid.sourceEventId ?? input.sourceEventId ?? null,
    ownerExternalId: raid.ownerExternalId ?? input.ownerExternalId ?? null,
    ownerDisplayName: raid.ownerDisplayName ?? input.ownerDisplayName ?? null,
    ownerSlackUserId: raid.ownerSlackUserId ?? input.ownerSlackUserId ?? null,
  };
}

export async function createRaid(
  input: CreateRaidInput,
  context: CreateRaidContext,
): Promise<RaidPost> {
  const withDedupeLock = context.withDedupeLock ?? defaultWithDedupeLock;
  const dedupeKey = buildDedupeKey(input.platform, input.postUrl);

  return withDedupeLock(dedupeKey, async () => {
    const dedupeLookup = context.findRaidByDedupeKey ?? findRaidByDedupeKey;
    const existingRaid = await dedupeLookup({
      platform: input.platform,
      postUrl: input.postUrl,
      sourceEventId: input.sourceEventId ?? null,
    });

    if (existingRaid) {
      let raid = existingRaid;

      if (shouldApplyWebhookMetadata(input)) {
        raid = await updateRaidPostWebhookMetadata({
          raidPostId: existingRaid.id,
          normalizedPostUrl: normalizePostUrl(input.postUrl),
          sourceEventId: input.sourceEventId ?? null,
          ownerExternalId: input.ownerExternalId ?? null,
          ownerDisplayName: input.ownerDisplayName ?? null,
          ownerSlackUserId: input.ownerSlackUserId ?? null,
        });
      }

      if (
        input.publishedAt &&
        raid.timingConfidence === "low" &&
        typeof context.client.chat.update === "function"
      ) {
        const corrected = await (context.correctRaidPublishedAt ?? correctRaidPublishedAt)({
          raidPostId: raid.id,
          publishedAt: input.publishedAt,
          correctedBy: input.createdBySlackUserId,
          client: context.client as Parameters<typeof correctRaidPublishedAt>[0]["client"],
        });

        return mergeRaidMetadata(
          {
            ...raid,
            publishedAt: corrected.raid.publishedAt,
            slackPostedAt: corrected.raid.slackPostedAt,
            timingConfidence: corrected.raid.timingConfidence,
            monthKey: corrected.raid.monthKey,
          },
          input,
        );
      }

      return mergeRaidMetadata(raid, input);
    }

    const slackPostedAt = context.now ? context.now() : new Date();
    const message = buildSlackMessage(input, slackPostedAt);
    const response = await context.client.chat.postMessage({
      channel: env.SLACK_RAID_CHANNEL_ID,
      text: message.text,
      blocks: message.blocks,
    });

    return (context.insertRaidPost ?? insertRaidPost)(
      buildInsertInput(input, context, slackPostedAt, response),
    );
  });
}
