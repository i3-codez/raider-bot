import type { DbClient, DbTransaction } from "../../db/sql.js";
import { insertRaidTimingCorrection } from "../../db/queries/insert-raid-timing-correction.js";
import {
  type UpdateRaidPublishedAtParams,
  updateRaidPublishedAt,
} from "../../db/queries/update-raid-published-at.js";
import { minutesBetween, deriveMonthKey } from "../../lib/time.js";
import { buildRaidMessage } from "../../slack/blocks/build-raid-message.js";
import { SCORING_WINDOWS } from "../scoring/scoring-config.js";
import type { ActionType, ScoringWindowLabel } from "../scoring/types.js";
import type { Platform, RaidTimingConfidence } from "./types.js";

interface SlackUpdatePayload {
  channel: string;
  ts: string;
  text: string;
  blocks: unknown[];
}

export interface SlackClientLike {
  chat: {
    update(payload: SlackUpdatePayload): Promise<unknown>;
  };
}

export interface RaidPostRecord {
  id: string;
  clientName: string;
  platform: Platform;
  postUrl: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
  slackChannelId: string;
  slackMessageTs: string;
  timingConfidence: RaidTimingConfidence;
  monthKey: string;
}

export interface EngagementLogRecord {
  id: string;
  raidPostId: string;
  slackUserId: string;
  slackReaction: string;
  actionType: ActionType;
  reactedAt: Date;
  minutesFromPublish: number;
  scoringWindow: ScoringWindowLabel;
  pointsAwarded: number;
  removedAt: Date | null;
}

export interface RaidTimingCorrectionRecord {
  raidPostId: string;
  previousPublishedAt: Date | null;
  newPublishedAt: Date;
  previousTimingConfidence: RaidTimingConfidence;
  newTimingConfidence: RaidTimingConfidence;
  correctedBy: string;
  reason: "authoritative_publish_time";
}

export interface EngagementScoreUpdate {
  id: string;
  minutesFromPublish: number;
  scoringWindow: ScoringWindowLabel;
  pointsAwarded: number;
  removedAt: Date | null;
}

export interface CorrectionStore {
  getRaidById(raidPostId: string): Promise<RaidPostRecord | null>;
  getEngagementsByRaidId(raidPostId: string): Promise<EngagementLogRecord[]>;
  insertRaidTimingCorrection(input: RaidTimingCorrectionRecord): Promise<void>;
  updateRaidPublishedAt(
    input: Omit<UpdateRaidPublishedAtParams, "executor">,
  ): Promise<RaidPostRecord>;
}

interface SqlRaidRow {
  id: string;
  client_name: string;
  platform: string;
  post_url: string;
  published_at: Date | string | null;
  slack_posted_at: Date | string;
  slack_channel_id: string;
  slack_message_ts: string;
  timing_confidence: string;
  month_key: string;
}

interface SqlEngagementRow {
  id: string;
  raid_post_id: string;
  slack_user_id: string;
  slack_reaction: string;
  action_type: string;
  reacted_at: Date | string;
  minutes_from_publish: number;
  scoring_window: string;
  points_awarded: number;
  removed_at: Date | string | null;
}

interface DatabaseWithTransaction {
  begin<T>(callback: (transaction: DbTransaction) => Promise<T>): Promise<T>;
}

export interface CorrectRaidPublishedAtInput {
  raidPostId: string;
  publishedAt: Date;
  correctedBy: string;
  client: SlackClientLike;
  db?: DatabaseWithTransaction;
  store?: CorrectionStore;
}

export interface CorrectRaidPublishedAtResult {
  raid: RaidPostRecord;
  engagementUpdates: EngagementScoreUpdate[];
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRaidRow(row: SqlRaidRow): RaidPostRecord {
  return {
    id: row.id,
    clientName: row.client_name,
    platform: row.platform as Platform,
    postUrl: row.post_url,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    slackPostedAt: toDate(row.slack_posted_at),
    slackChannelId: row.slack_channel_id,
    slackMessageTs: row.slack_message_ts,
    timingConfidence: row.timing_confidence as RaidTimingConfidence,
    monthKey: row.month_key,
  };
}

function mapEngagementRow(row: SqlEngagementRow): EngagementLogRecord {
  return {
    id: row.id,
    raidPostId: row.raid_post_id,
    slackUserId: row.slack_user_id,
    slackReaction: row.slack_reaction,
    actionType: row.action_type as ActionType,
    reactedAt: toDate(row.reacted_at),
    minutesFromPublish: row.minutes_from_publish,
    scoringWindow: row.scoring_window as ScoringWindowLabel,
    pointsAwarded: row.points_awarded,
    removedAt: row.removed_at ? toDate(row.removed_at) : null,
  };
}

function resolveScoringWindow(minutesFromPublish: number) {
  if (minutesFromPublish < 0) {
    throw new Error("Corrected publish time cannot be later than an engagement event.");
  }

  const scoringWindow =
    SCORING_WINDOWS.find((window) => {
      if (window.maxMinutesExclusive === null) {
        return minutesFromPublish >= window.minMinutes;
      }

      return (
        minutesFromPublish >= window.minMinutes &&
        minutesFromPublish < window.maxMinutesExclusive
      );
    }) ?? SCORING_WINDOWS[SCORING_WINDOWS.length - 1];

  return scoringWindow;
}

export function recalculateEngagementScores(
  engagements: EngagementLogRecord[],
  publishedAt: Date,
): EngagementScoreUpdate[] {
  return engagements.map((engagement) => {
    const minutesFromPublish = minutesBetween(engagement.reactedAt, publishedAt);
    const scoringWindow = resolveScoringWindow(minutesFromPublish);

    return {
      id: engagement.id,
      minutesFromPublish,
      scoringWindow: scoringWindow.label,
      pointsAwarded: scoringWindow.points,
      removedAt: engagement.removedAt,
    };
  });
}

export function createCorrectionStore(executor: DbTransaction): CorrectionStore {
  return {
    async getRaidById(raidPostId) {
      const rows = await executor<SqlRaidRow[]>`
        select
          id,
          client_name,
          platform,
          post_url,
          published_at,
          slack_posted_at,
          slack_channel_id,
          slack_message_ts,
          timing_confidence,
          month_key
        from raid_posts
        where id = ${raidPostId}
        limit 1
      `;

      const row = rows[0];
      return row ? mapRaidRow(row) : null;
    },
    async getEngagementsByRaidId(raidPostId) {
      const rows = await executor<SqlEngagementRow[]>`
        select
          id,
          raid_post_id,
          slack_user_id,
          slack_reaction,
          action_type,
          reacted_at,
          minutes_from_publish,
          scoring_window,
          points_awarded,
          removed_at
        from engagement_logs
        where raid_post_id = ${raidPostId}
        order by created_at asc
      `;

      return rows.map(mapEngagementRow);
    },
    async insertRaidTimingCorrection(input) {
      await insertRaidTimingCorrection({
        executor,
        ...input,
      });
    },
    updateRaidPublishedAt(input) {
      return updateRaidPublishedAt({
        executor,
        ...input,
      });
    },
  };
}

async function runCorrection(
  store: CorrectionStore,
  input: Omit<CorrectRaidPublishedAtInput, "db" | "store">,
): Promise<CorrectRaidPublishedAtResult> {
  const raid = await store.getRaidById(input.raidPostId);

  if (!raid) {
    throw new Error(`Raid post ${input.raidPostId} was not found.`);
  }

  const engagementUpdates = recalculateEngagementScores(
    await store.getEngagementsByRaidId(raid.id),
    input.publishedAt,
  );

  await store.insertRaidTimingCorrection({
    raidPostId: raid.id,
    previousPublishedAt: raid.publishedAt,
    newPublishedAt: input.publishedAt,
    previousTimingConfidence: raid.timingConfidence,
    newTimingConfidence: "high",
    correctedBy: input.correctedBy,
    reason: "authoritative_publish_time",
  });

  const updatedRaid = await store.updateRaidPublishedAt({
    raidPostId: raid.id,
    publishedAt: input.publishedAt,
    monthKey: deriveMonthKey(input.publishedAt),
    engagementUpdates,
  });

  const referenceTime = updatedRaid.publishedAt ?? input.publishedAt;
  const message = buildRaidMessage({
    clientName: updatedRaid.clientName,
    platform: updatedRaid.platform,
    postUrl: updatedRaid.postUrl,
    timingConfidence: updatedRaid.timingConfidence,
    referenceTime,
  });

  await input.client.chat.update({
    channel: updatedRaid.slackChannelId,
    ts: updatedRaid.slackMessageTs,
    text: message.text,
    blocks: message.blocks,
  });

  return {
    raid: updatedRaid,
    engagementUpdates,
  };
}

export async function correctRaidPublishedAt(
  input: CorrectRaidPublishedAtInput,
): Promise<CorrectRaidPublishedAtResult> {
  if (input.store) {
    return runCorrection(input.store, {
      raidPostId: input.raidPostId,
      publishedAt: input.publishedAt,
      correctedBy: input.correctedBy,
      client: input.client,
    });
  }

  const database =
    input.db ??
    ((await import("../../db/sql.js")).getSql() as DbClient & DatabaseWithTransaction);

  return database.begin((transaction) =>
    runCorrection(createCorrectionStore(transaction), {
      raidPostId: input.raidPostId,
      publishedAt: input.publishedAt,
      correctedBy: input.correctedBy,
      client: input.client,
    }),
  );
}
