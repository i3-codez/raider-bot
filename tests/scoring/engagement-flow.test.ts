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
