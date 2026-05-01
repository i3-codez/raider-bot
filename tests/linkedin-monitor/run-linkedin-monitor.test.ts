import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runLinkedinMonitor", () => {
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
      APIFY_LINKEDIN_MONITOR_ACTOR_ID: "harvestapi/linkedin-profile-posts",
    };
    vi.resetModules();
  });

  const now = new Date("2026-04-29T12:30:40.000Z");

  const validPost = {
    type: "post",
    id: "post-1",
    linkedinUrl: "https://www.linkedin.com/posts/williamhgates_post-1",
    author: {
      name: "Bill Gates",
      publicIdentifier: "williamhgates",
      linkedinUrl: "https://www.linkedin.com/in/williamhgates",
    },
    postedAt: {
      timestamp: 1745930540000,
      date: "2026-04-29T12:29:00.000Z",
    },
  };

  const testClients = [
    {
      url: "https://www.linkedin.com/in/williamhgates",
      slug: "williamhgates",
      clientName: "Bill Gates",
    },
  ] as const;

  it("processes an empty dataset cleanly", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi.fn();
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.postsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
    expect(result.failures).toBe(0);
    expect(apify.runActor).toHaveBeenCalledOnce();
    expect(createRaid).not.toHaveBeenCalled();
  });

  it("skips when LINKEDIN_CLIENTS is empty without calling Apify (no-op)", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: [],
        now: () => now,
      },
    );

    expect(apify.runActor).not.toHaveBeenCalled();
    expect(result.postsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
  });

  it("creates raids for originals, skips malformed and unmapped", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi
      .fn()
      .mockImplementation(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([
        validPost,
        { nothing: "useful" },
        {
          ...validPost,
          id: "post-3",
          author: {
            ...validPost.author,
            publicIdentifier: "unknown",
            linkedinUrl: "https://www.linkedin.com/in/unknown",
          },
        },
      ]),
    };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.postsFetched).toBe(3);
    expect(result.raidsProcessed).toBe(1);
    expect(result.skipped.malformed).toBe(1);
    expect(result.skipped.unmapped).toBe(1);
    expect(createRaid).toHaveBeenCalledOnce();
    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        postUrl: validPost.linkedinUrl,
        clientName: "Bill Gates",
        platform: "linkedin",
        sourceEventId: "post-1",
        createdBySlackUserId: "linkedin-monitor",
        ownerExternalId: "williamhgates",
        ownerDisplayName: "Bill Gates",
      }),
      expect.any(Object),
    );
  });

  it("continues after a createRaid failure and reports failures count", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([validPost, { ...validPost, id: "post-2" }]),
    };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.failures).toBe(1);
    expect(result.raidsProcessed).toBe(1);
    expect(createRaid).toHaveBeenCalledTimes(2);
  });

  it("dry-run skips createRaid entirely", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi.fn();
    const apify = { runActor: vi.fn().mockResolvedValue([validPost]) };

    const result = await runLinkedinMonitor(
      { dryRun: true },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(createRaid).not.toHaveBeenCalled();
    expect(result.raidsProcessed).toBe(0);
    expect(result.postsFetched).toBe(1);
  });

  it("computes a since-window covering the last 7 minutes from now() and forwards target URLs", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.sinceWindow.to.toISOString()).toBe("2026-04-29T12:30:40.000Z");
    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-29T12:23:40.000Z");
    const [actorId, input] = apify.runActor.mock.calls[0]!;
    expect(actorId).toBe("harvestapi/linkedin-profile-posts");
    expect(input.postedLimitDate).toBe("2026-04-29T12:23:40.000Z");
    expect(input.targetUrls).toEqual(["https://www.linkedin.com/in/williamhgates"]);
    expect(input.includeReposts).toBe(false);
    expect(input.includeQuotePosts).toBe(false);
  });

  it("respects an explicit sinceMinutes override", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false, sinceMinutes: 30 },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-29T12:00:40.000Z");
  });
});
