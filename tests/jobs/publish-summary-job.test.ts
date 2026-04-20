import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("publishSummaryJob", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
      RAIDER_EXCLUDE_SELF_RAIDS: "false",
      APIFY_TOKEN: "test-apify-token",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("falls back to the raid channel when no summary channel is configured", async () => {
    const { publishSummaryJob } = await import("../../src/jobs/publish-summary.js");
    const postMessage = vi.fn().mockResolvedValue(undefined);

    const result = await publishSummaryJob(
      {
        cadence: "daily",
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        querySummaryLeaderboard: vi.fn().mockResolvedValue([]),
        querySummaryTotals: vi.fn().mockResolvedValue({
          totalPoints: 0,
          uniqueRaidsEngaged: 0,
          earlyWindowActions: 0,
          totalActions: 0,
          earlyWindowActionRate: 0,
        }),
      },
    );

    expect(result.channelId).toBe("C_RAIDS");
    expect(postMessage).toHaveBeenCalledWith({
      channel: "C_RAIDS",
      text: expect.stringContaining("Daily Summary"),
      blocks: expect.any(Array),
    });
  });

  it("skips Slack posting in dry-run mode", async () => {
    const { publishSummaryJob } = await import("../../src/jobs/publish-summary.js");
    const postMessage = vi.fn().mockResolvedValue(undefined);

    const result = await publishSummaryJob(
      {
        cadence: "weekly",
        dryRun: true,
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        querySummaryLeaderboard: vi.fn().mockResolvedValue([]),
        querySummaryTotals: vi.fn().mockResolvedValue({
          totalPoints: 0,
          uniqueRaidsEngaged: 0,
          earlyWindowActions: 0,
          totalActions: 0,
          earlyWindowActionRate: 0,
        }),
      },
    );

    expect(result.dryRun).toBe(true);
    expect(postMessage).not.toHaveBeenCalled();
    expect(result.payload.text).toContain("Weekly Summary");
  });
});
