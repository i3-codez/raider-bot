import type { App } from "@slack/bolt";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ReactionEventName = "reaction_added" | "reaction_removed";

interface RegisteredHandlers {
  reaction_added?: (args: { event: ReactionEventPayload }) => Promise<void>;
  reaction_removed?: (args: { event: ReactionEventPayload }) => Promise<void>;
}

interface ReactionEventPayload {
  user: string;
  reaction: string;
  event_ts: string;
  item: {
    type: string;
    channel?: string;
    ts?: string;
  };
}

interface RaidLookupResult {
  id: string;
  publishedAt: Date | null;
  slackPostedAt: Date;
}

interface EngagementLogRecord {
  raid_post_id: string;
  slack_user_id: string;
  slack_reaction: string;
  action_type: string;
  reacted_at: Date;
  minutes_from_publish: number;
  scoring_window: string;
  points_awarded: number;
  removed_at: Date | null;
}

function createMockApp() {
  const handlers: RegisteredHandlers = {};
  const app = {
    event: vi.fn((name: ReactionEventName, handler: RegisteredHandlers[ReactionEventName]) => {
      handlers[name] = handler;
    }),
  } as unknown as App;

  return { app, handlers };
}

function buildReactionEvent(overrides: Partial<ReactionEventPayload> = {}): ReactionEventPayload {
  return {
    user: "U123",
    reaction: "heart",
    event_ts: "1712769000.000100",
    item: {
      type: "message",
      channel: "C123",
      ts: "1712768999.000100",
    },
    ...overrides,
    item: {
      type: "message",
      channel: "C123",
      ts: "1712768999.000100",
      ...overrides.item,
    },
  };
}

function createEngagementSqlHarness() {
  const rows = new Map<string, EngagementLogRecord>();
  const statements: string[] = [];

  const sql = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]): Promise<EngagementLogRecord[]> => {
      const statement = strings.join("__value__");
      statements.push(statement);

      if (statement.includes("insert into engagement_logs")) {
        const [
          raidPostId,
          slackUserId,
          slackReaction,
          actionType,
          reactedAt,
          minutesFromPublish,
          scoringWindow,
          pointsAwarded,
        ] = values as [
          string,
          string,
          string,
          string,
          Date,
          number,
          string,
          number,
        ];

        const key = `${raidPostId}:${slackUserId}:${actionType}`;
        const existing = rows.get(key);

        if (!existing) {
          rows.set(key, {
            raid_post_id: raidPostId,
            slack_user_id: slackUserId,
            slack_reaction: slackReaction,
            action_type: actionType,
            reacted_at: reactedAt,
            minutes_from_publish: minutesFromPublish,
            scoring_window: scoringWindow,
            points_awarded: pointsAwarded,
            removed_at: null,
          });

          return [];
        }

        if (existing.removed_at) {
          rows.set(key, {
            ...existing,
            slack_reaction: slackReaction,
            reacted_at: reactedAt,
            minutes_from_publish: minutesFromPublish,
            scoring_window: scoringWindow,
            points_awarded: pointsAwarded,
            removed_at: null,
          });
        }

        return [];
      }

      if (statement.includes("update engagement_logs")) {
        const [removedAt, raidPostId, slackUserId, actionType] = values as [
          Date,
          string,
          string,
          string,
        ];

        const key = `${raidPostId}:${slackUserId}:${actionType}`;
        const existing = rows.get(key);

        if (existing && !existing.removed_at) {
          rows.set(key, {
            ...existing,
            removed_at: removedAt,
          });
        }

        return [];
      }

      throw new Error(`Unexpected SQL statement in test harness: ${statement}`);
    },
  );

  return {
    rows,
    sql,
    statements,
  };
}

describe("reaction scoring flow bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.doUnmock("../../src/slack/events/register-reaction-handlers.js");
  });

  it("bootstraps reaction handlers through registerEvents(app)", async () => {
    const registerReactionHandlers = vi.fn();

    vi.doMock("../../src/slack/events/register-reaction-handlers.js", () => ({
      registerReactionHandlers,
    }));

    const { registerEvents } = await import("../../src/slack/register-events.js");
    const { app } = createMockApp();

    registerEvents(app);

    expect(registerReactionHandlers).toHaveBeenCalledExactlyOnceWith(app);
  });
});

describe("registerReactionHandlers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.doUnmock("../../src/slack/events/register-reaction-handlers.js");
    vi.doUnmock("../../src/db/queries/find-raid-by-slack-ref.js");
    vi.doUnmock("../../src/domain/scoring/claim-engagement.js");
    vi.doUnmock("../../src/domain/scoring/reverse-engagement.js");
  });

  it("maps the canonical reactions to action types and ignores unsupported emoji", async () => {
    const findRaidBySlackRef = vi.fn<(...args: unknown[]) => Promise<RaidLookupResult | null>>();
    const claimEngagement = vi.fn();
    const reverseEngagement = vi.fn();

    vi.doMock("../../src/db/queries/find-raid-by-slack-ref.js", () => ({
      findRaidBySlackRef,
    }));
    vi.doMock("../../src/domain/scoring/claim-engagement.js", () => ({
      claimEngagement,
    }));
    vi.doMock("../../src/domain/scoring/reverse-engagement.js", () => ({
      reverseEngagement,
    }));

    findRaidBySlackRef.mockResolvedValue({
      id: "raid-1",
      publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      slackPostedAt: new Date("2026-04-10T16:00:05.000Z"),
    });

    const { registerReactionHandlers } = await import(
      "../../src/slack/events/register-reaction-handlers.js"
    );
    const { app, handlers } = createMockApp();

    registerReactionHandlers(app);

    expect(app.event).toHaveBeenCalledTimes(2);
    expect(app.event).toHaveBeenNthCalledWith(1, "reaction_added", expect.any(Function));
    expect(app.event).toHaveBeenNthCalledWith(2, "reaction_removed", expect.any(Function));

    const canonicalMappings = [
      { emoji: "heart", actionType: "like" },
      { emoji: "speech_balloon", actionType: "comment" },
      { emoji: "repeat", actionType: "repost" },
      { emoji: "memo", actionType: "quote_post" },
    ] as const;

    for (const mapping of canonicalMappings) {
      await handlers.reaction_added?.({
        event: buildReactionEvent({ reaction: mapping.emoji }),
      });
    }

    expect(claimEngagement).toHaveBeenCalledTimes(4);
    expect(reverseEngagement).not.toHaveBeenCalled();

    for (const [index, mapping] of canonicalMappings.entries()) {
      expect(claimEngagement).toHaveBeenNthCalledWith(index + 1, {
        raid: expect.objectContaining({ id: "raid-1" }),
        slackUserId: "U123",
        slackReaction: mapping.emoji,
        actionType: mapping.actionType,
        eventTime: new Date("2024-04-10T17:10:00.000Z"),
      });
    }

    await handlers.reaction_added?.({
      event: buildReactionEvent({ reaction: "thumbsup" }),
    });

    expect(claimEngagement).toHaveBeenCalledTimes(4);
    expect(findRaidBySlackRef).toHaveBeenCalledTimes(4);
  });

  it("delegates reaction_added to claimEngagement and reaction_removed to reverseEngagement", async () => {
    const findRaidBySlackRef = vi.fn<(...args: unknown[]) => Promise<RaidLookupResult | null>>();
    const claimEngagement = vi.fn();
    const reverseEngagement = vi.fn();

    vi.doMock("../../src/db/queries/find-raid-by-slack-ref.js", () => ({
      findRaidBySlackRef,
    }));
    vi.doMock("../../src/domain/scoring/claim-engagement.js", () => ({
      claimEngagement,
    }));
    vi.doMock("../../src/domain/scoring/reverse-engagement.js", () => ({
      reverseEngagement,
    }));

    findRaidBySlackRef.mockResolvedValue({
      id: "raid-2",
      publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      slackPostedAt: new Date("2026-04-10T16:00:05.000Z"),
    });

    const { registerReactionHandlers } = await import(
      "../../src/slack/events/register-reaction-handlers.js"
    );
    const { app, handlers } = createMockApp();

    registerReactionHandlers(app);

    const event = buildReactionEvent({ reaction: "memo" });

    await handlers.reaction_added?.({ event });
    await handlers.reaction_removed?.({ event });

    expect(findRaidBySlackRef).toHaveBeenCalledTimes(2);
    expect(findRaidBySlackRef).toHaveBeenNthCalledWith(1, {
      slackChannelId: "C123",
      slackMessageTs: "1712768999.000100",
    });
    expect(findRaidBySlackRef).toHaveBeenNthCalledWith(2, {
      slackChannelId: "C123",
      slackMessageTs: "1712768999.000100",
    });
    expect(claimEngagement).toHaveBeenCalledExactlyOnceWith({
      raid: expect.objectContaining({ id: "raid-2" }),
      slackUserId: "U123",
      slackReaction: "memo",
      actionType: "quote_post",
      eventTime: new Date("2024-04-10T17:10:00.000Z"),
    });
    expect(reverseEngagement).toHaveBeenCalledExactlyOnceWith({
      raid: expect.objectContaining({ id: "raid-2" }),
      slackUserId: "U123",
      slackReaction: "memo",
      actionType: "quote_post",
      eventTime: new Date("2024-04-10T17:10:00.000Z"),
    });
  });

  it("silently ignores non-message items, unknown raid references, and unsupported emoji", async () => {
    const findRaidBySlackRef = vi.fn<(...args: unknown[]) => Promise<RaidLookupResult | null>>();
    const claimEngagement = vi.fn();
    const reverseEngagement = vi.fn();

    vi.doMock("../../src/db/queries/find-raid-by-slack-ref.js", () => ({
      findRaidBySlackRef,
    }));
    vi.doMock("../../src/domain/scoring/claim-engagement.js", () => ({
      claimEngagement,
    }));
    vi.doMock("../../src/domain/scoring/reverse-engagement.js", () => ({
      reverseEngagement,
    }));

    findRaidBySlackRef.mockResolvedValue(null);

    const { registerReactionHandlers } = await import(
      "../../src/slack/events/register-reaction-handlers.js"
    );
    const { app, handlers } = createMockApp();

    registerReactionHandlers(app);

    await handlers.reaction_added?.({
      event: buildReactionEvent({
        item: { type: "file", channel: "C123", ts: "1712768999.000100" },
      }),
    });

    await handlers.reaction_added?.({
      event: buildReactionEvent({ reaction: "thumbsup" }),
    });

    await handlers.reaction_added?.({
      event: buildReactionEvent({ reaction: "heart" }),
    });

    await handlers.reaction_removed?.({
      event: buildReactionEvent({ reaction: "heart" }),
    });

    expect(findRaidBySlackRef).toHaveBeenCalledTimes(2);
    expect(claimEngagement).not.toHaveBeenCalled();
    expect(reverseEngagement).not.toHaveBeenCalled();
  });
});

describe("engagement scoring persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.doUnmock("../../src/db/sql.js");
    vi.doUnmock("../../src/db/queries/engagement-logs.js");
    vi.doUnmock("../../src/domain/scoring/claim-engagement.js");
    vi.doUnmock("../../src/domain/scoring/reverse-engagement.js");
  });

  it("dedupes duplicate deliveries, stacks different actions, preserves removal audit rows, and reactivates the canonical row", async () => {
    const harness = createEngagementSqlHarness();

    vi.doMock("../../src/db/sql.js", () => ({
      sql: harness.sql,
    }));

    const { claimEngagement } = await import("../../src/domain/scoring/claim-engagement.js");
    const { reverseEngagement } = await import("../../src/domain/scoring/reverse-engagement.js");

    const raid = {
      id: "raid-1",
      publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      slackPostedAt: new Date("2026-04-10T16:00:05.000Z"),
    };

    await claimEngagement({
      raid,
      slackUserId: "U123",
      slackReaction: "heart",
      actionType: "like",
      eventTime: new Date("2026-04-10T16:09:00.000Z"),
    });

    await claimEngagement({
      raid,
      slackUserId: "U123",
      slackReaction: "heart",
      actionType: "like",
      eventTime: new Date("2026-04-10T16:09:30.000Z"),
    });

    await claimEngagement({
      raid,
      slackUserId: "U123",
      slackReaction: "speech_balloon",
      actionType: "comment",
      eventTime: new Date("2026-04-10T16:15:00.000Z"),
    });

    expect(harness.rows.size).toBe(2);

    const likeRow = harness.rows.get("raid-1:U123:like");
    const commentRow = harness.rows.get("raid-1:U123:comment");

    expect(likeRow).toMatchObject({
      slack_reaction: "heart",
      action_type: "like",
      minutes_from_publish: 9,
      scoring_window: "0-10m",
      points_awarded: 10,
      removed_at: null,
    });
    expect(commentRow).toMatchObject({
      slack_reaction: "speech_balloon",
      action_type: "comment",
      minutes_from_publish: 15,
      scoring_window: "10-20m",
      points_awarded: 8,
      removed_at: null,
    });

    await reverseEngagement({
      raid,
      slackUserId: "U123",
      slackReaction: "heart",
      actionType: "like",
      eventTime: new Date("2026-04-10T16:25:00.000Z"),
    });

    expect(harness.rows.get("raid-1:U123:like")?.removed_at).toEqual(
      new Date("2026-04-10T16:25:00.000Z"),
    );

    await claimEngagement({
      raid,
      slackUserId: "U123",
      slackReaction: "heart",
      actionType: "like",
      eventTime: new Date("2026-04-10T16:26:00.000Z"),
    });

    expect(harness.rows.size).toBe(2);
    expect(harness.rows.get("raid-1:U123:like")).toMatchObject({
      slack_reaction: "heart",
      action_type: "like",
      minutes_from_publish: 26,
      scoring_window: "20-30m",
      points_awarded: 6,
      removed_at: null,
    });
  });

  it("scores against publishedAt when present and falls back to slackPostedAt otherwise", async () => {
    const harness = createEngagementSqlHarness();

    vi.doMock("../../src/db/sql.js", () => ({
      sql: harness.sql,
    }));

    const { claimEngagement } = await import("../../src/domain/scoring/claim-engagement.js");

    await claimEngagement({
      raid: {
        id: "raid-published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
        slackPostedAt: new Date("2026-04-10T16:05:00.000Z"),
      },
      slackUserId: "U123",
      slackReaction: "repeat",
      actionType: "repost",
      eventTime: new Date("2026-04-10T16:31:00.000Z"),
    });

    await claimEngagement({
      raid: {
        id: "raid-fallback",
        publishedAt: null,
        slackPostedAt: new Date("2026-04-10T16:05:00.000Z"),
      },
      slackUserId: "U456",
      slackReaction: "memo",
      actionType: "quote_post",
      eventTime: new Date("2026-04-10T17:10:00.000Z"),
    });

    expect(harness.rows.get("raid-published:U123:repost")).toMatchObject({
      minutes_from_publish: 31,
      scoring_window: "30-60m",
      points_awarded: 3,
    });
    expect(harness.rows.get("raid-fallback:U456:quote_post")).toMatchObject({
      minutes_from_publish: 65,
      scoring_window: "60m+",
      points_awarded: 0,
    });
  });

  it("uses the canonical insert conflict clause and removal update semantics", async () => {
    const harness = createEngagementSqlHarness();

    vi.doMock("../../src/db/sql.js", () => ({
      sql: harness.sql,
    }));

    const { claimEngagementLog, reverseEngagementLog } = await import(
      "../../src/db/queries/engagement-logs.js"
    );

    await claimEngagementLog({
      raidPostId: "raid-1",
      slackUserId: "U123",
      slackReaction: "heart",
      actionType: "like",
      reactedAt: new Date("2026-04-10T16:09:00.000Z"),
      minutesFromPublish: 9,
      scoringWindow: "0-10m",
      pointsAwarded: 10,
    });

    await reverseEngagementLog({
      raidPostId: "raid-1",
      slackUserId: "U123",
      actionType: "like",
      removedAt: new Date("2026-04-10T16:25:00.000Z"),
    });

    expect(harness.statements[0]).toContain(
      "ON CONFLICT (raid_post_id, slack_user_id, action_type) DO UPDATE",
    );
    expect(harness.statements[0]).toContain("WHERE engagement_logs.removed_at IS NOT NULL");
    expect(harness.statements[1]).toContain("update engagement_logs");
    expect(harness.statements[1]).toContain("set removed_at =");
    expect(harness.statements[1]).not.toContain("delete from engagement_logs");
  });
});
