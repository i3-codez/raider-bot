import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runXMonitor", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
      APIFY_TOKEN: "apify_test",
      APIFY_X_MONITOR_ACTOR_ID: "danek~twitter-scraper-ppr",
    };
    vi.resetModules();
  });

  const now = new Date("2026-04-20T12:30:40.000Z");
  const validTweet = {
    id: "tweet-1",
    url: "https://x.com/Meanwhile/status/tweet-1",
    user: { screen_name: "Meanwhile", name: "Meanwhile" },
    created_at: "2026-04-20T12:29:00.000Z",
    is_retweet: false,
    in_reply_to_status_id: null,
  };

  it("processes an empty dataset cleanly", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.tweetsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
    expect(result.failures).toBe(0);
    expect(createRaid).not.toHaveBeenCalled();
  });

  it("creates raids for originals, skips retweets/replies/unmapped", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn().mockImplementation(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([
        validTweet,
        { ...validTweet, id: "tweet-2", is_retweet: true },
        { ...validTweet, id: "tweet-3", in_reply_to_status_id: "111" },
        { ...validTweet, id: "tweet-4", user: { screen_name: "unknown", name: "Unknown" } },
      ]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.tweetsFetched).toBe(4);
    expect(result.raidsProcessed).toBe(1);
    expect(result.skipped.nonOriginal).toBe(2);
    expect(result.skipped.unmapped).toBe(1);
    expect(createRaid).toHaveBeenCalledOnce();
    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        postUrl: validTweet.url,
        clientName: "Meanwhile",
        platform: "x",
        sourceEventId: "tweet-1",
        createdBySlackUserId: "x-monitor",
        ownerExternalId: "meanwhile",
        ownerDisplayName: "Meanwhile",
      }),
      expect.any(Object),
    );
  });

  it("counts malformed items via skipped.malformed", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = {
      runActor: vi.fn().mockResolvedValue([{ nothing: "useful" }]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.skipped.malformed).toBe(1);
    expect(result.raidsProcessed).toBe(0);
  });

  it("continues after a createRaid failure and reports failures count", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([
        validTweet,
        { ...validTweet, id: "tweet-5" },
      ]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.failures).toBe(1);
    expect(result.raidsProcessed).toBe(1);
    expect(createRaid).toHaveBeenCalledTimes(2);
  });

  it("dry-run skips createRaid entirely", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = {
      runActor: vi.fn().mockResolvedValue([validTweet]),
    };

    const result = await runXMonitor(
      { dryRun: true },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(createRaid).not.toHaveBeenCalled();
    expect(result.raidsProcessed).toBe(0);
    expect(result.tweetsFetched).toBe(1);
  });

  it("computes a since-window covering the last 5 minutes from now()", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "danek~twitter-scraper-ppr",
        createRaid: vi.fn(),
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.sinceWindow.to.toISOString()).toBe("2026-04-20T12:30:40.000Z");
    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-20T12:25:40.000Z");
    const [, input] = apify.runActor.mock.calls[0]!;
    expect(input.query).toContain("since:2026-04-20_12:25:40_UTC");
    expect(input.query).toContain("from:meanwhile");
  });
});
