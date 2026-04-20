import { describe, expect, it, vi } from "vitest";

import {
  correctRaidPublishedAt,
  type CorrectionStore,
  type EngagementLogRecord,
  type RaidPostRecord,
  type RaidTimingCorrectionRecord,
} from "../../src/domain/raids/correct-raid-published-at.js";

interface InMemoryStore extends CorrectionStore {
  correctionRows: RaidTimingCorrectionRecord[];
  raid: RaidPostRecord;
  engagements: EngagementLogRecord[];
}

function createStore(): InMemoryStore {
  const raid: RaidPostRecord = {
    id: "raid-1",
    clientName: "Impact3",
    platform: "x",
    postUrl: "https://x.com/impact3/status/123",
    publishedAt: new Date("2026-04-10T12:20:00.000Z"),
    slackPostedAt: new Date("2026-04-10T12:20:00.000Z"),
    slackChannelId: "C123",
    slackMessageTs: "1712751600.000100",
    timingConfidence: "low",
    monthKey: "2026-04",
  };

  const engagements: EngagementLogRecord[] = [
    {
      id: "eng-1",
      raidPostId: raid.id,
      slackUserId: "U111",
      slackReaction: "heart",
      actionType: "like",
      reactedAt: new Date("2026-04-10T12:05:00.000Z"),
      minutesFromPublish: -15,
      scoringWindow: "0-10m",
      pointsAwarded: 10,
      removedAt: null,
    },
    {
      id: "eng-2",
      raidPostId: raid.id,
      slackUserId: "U222",
      slackReaction: "speech_balloon",
      actionType: "comment",
      reactedAt: new Date("2026-04-10T12:15:00.000Z"),
      minutesFromPublish: -5,
      scoringWindow: "0-10m",
      pointsAwarded: 10,
      removedAt: new Date("2026-04-10T12:18:00.000Z"),
    },
    {
      id: "eng-3",
      raidPostId: raid.id,
      slackUserId: "U333",
      slackReaction: "repeat",
      actionType: "repost",
      reactedAt: new Date("2026-04-10T12:25:00.000Z"),
      minutesFromPublish: 5,
      scoringWindow: "0-10m",
      pointsAwarded: 10,
      removedAt: null,
    },
    {
      id: "eng-4",
      raidPostId: raid.id,
      slackUserId: "U444",
      slackReaction: "memo",
      actionType: "quote_post",
      reactedAt: new Date("2026-04-10T13:05:00.000Z"),
      minutesFromPublish: 45,
      scoringWindow: "30-60m",
      pointsAwarded: 3,
      removedAt: null,
    },
  ];

  const correctionRows: RaidTimingCorrectionRecord[] = [];

  return {
    raid,
    engagements,
    correctionRows,
    async getRaidById(raidPostId) {
      expect(raidPostId).toBe(raid.id);
      return this.raid;
    },
    async getEngagementsByRaidId(raidPostId) {
      expect(raidPostId).toBe(raid.id);
      return this.engagements;
    },
    async insertRaidTimingCorrection(input) {
      correctionRows.push(input);
    },
    async updateRaidPublishedAt(input) {
      this.raid = {
        ...this.raid,
        publishedAt: input.publishedAt,
        timingConfidence: "high",
        monthKey: input.monthKey,
      };

      this.engagements = this.engagements.map((engagement) => {
        const update = input.engagementUpdates.find((entry) => entry.id === engagement.id);

        if (!update) {
          return engagement;
        }

        return {
          ...engagement,
          minutesFromPublish: update.minutesFromPublish,
          scoringWindow: update.scoringWindow,
          pointsAwarded: update.pointsAwarded,
        };
      });

      return this.raid;
    },
  };
}

describe("correctRaidPublishedAt", () => {
  it("records the correction, recalculates engagements, preserves removals, and refreshes the Slack timing row", async () => {
    const store = createStore();
    const correctedPublishedAt = new Date("2026-04-10T12:00:00.000Z");
    const chatUpdate = vi.fn().mockResolvedValue({ ok: true });

    await correctRaidPublishedAt({
      raidPostId: store.raid.id,
      publishedAt: correctedPublishedAt,
      correctedBy: "UOPS1",
      client: {
        chat: {
          update: chatUpdate,
        },
      },
      store,
    });

    expect(store.correctionRows).toEqual([
      {
        raidPostId: "raid-1",
        previousPublishedAt: new Date("2026-04-10T12:20:00.000Z"),
        newPublishedAt: correctedPublishedAt,
        previousTimingConfidence: "low",
        newTimingConfidence: "high",
        correctedBy: "UOPS1",
        reason: "authoritative_publish_time",
      },
    ]);

    expect(store.engagements.map((engagement) => ({
      id: engagement.id,
      minutesFromPublish: engagement.minutesFromPublish,
      scoringWindow: engagement.scoringWindow,
      pointsAwarded: engagement.pointsAwarded,
      removedAt: engagement.removedAt,
    }))).toEqual([
      {
        id: "eng-1",
        minutesFromPublish: 5,
        scoringWindow: "0-10m",
        pointsAwarded: 10,
        removedAt: null,
      },
      {
        id: "eng-2",
        minutesFromPublish: 15,
        scoringWindow: "10-20m",
        pointsAwarded: 8,
        removedAt: new Date("2026-04-10T12:18:00.000Z"),
      },
      {
        id: "eng-3",
        minutesFromPublish: 25,
        scoringWindow: "20-30m",
        pointsAwarded: 6,
        removedAt: null,
      },
      {
        id: "eng-4",
        minutesFromPublish: 65,
        scoringWindow: "60m+",
        pointsAwarded: 0,
        removedAt: null,
      },
    ]);

    expect(store.raid.timingConfidence).toBe("high");
    expect(store.raid.publishedAt?.toISOString()).toBe("2026-04-10T12:00:00.000Z");
    expect(store.raid.monthKey).toBe("2026-04");

    expect(chatUpdate).toHaveBeenCalledTimes(1);

    const [payload] = chatUpdate.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      channel: "C123",
      ts: "1712751600.000100",
      text: expect.stringContaining("New post from"),
    });
    expect(payload.blocks[0]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: expect.stringContaining("just shipped: go go go!"),
      },
    });
  });
});
