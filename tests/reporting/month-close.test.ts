import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runMonthClose", () => {
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
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("supports dry-run mode without persisting snapshots", async () => {
    const { runMonthClose } = await import("../../src/domain/reporting/month-close.js");
    const replaceMonthlySnapshots = vi.fn().mockResolvedValue(undefined);
    const upsertJobRun = vi.fn().mockResolvedValue(undefined);

    const result = await runMonthClose(
      {
        dryRun: true,
        targetMonthKey: "2026-04",
      },
      {
        querySummaryLeaderboard: vi.fn().mockResolvedValue([]),
        querySummaryTotals: vi.fn().mockResolvedValue({
          totalPoints: 0,
          uniqueRaidsEngaged: 0,
          earlyWindowActions: 0,
          totalActions: 0,
          earlyWindowActionRate: 0,
        }),
        replaceMonthlySnapshots,
        upsertJobRun,
      },
    );

    expect(result.monthKey).toBe("2026-04");
    expect(result.persisted).toBe(false);
    expect(replaceMonthlySnapshots).not.toHaveBeenCalled();
    expect(upsertJobRun).not.toHaveBeenCalled();
  });

  it("is rerunnable without duplicating in-memory snapshot or job-run state", async () => {
    const { runMonthClose } = await import("../../src/domain/reporting/month-close.js");
    const snapshotStore = new Map();
    const jobRunStore = new Map();
    const replaceMonthlySnapshots = vi.fn().mockImplementation(async (input) => {
      snapshotStore.set(input.monthKey, input);
    });
    const upsertJobRun = vi.fn().mockImplementation(async (input) => {
      jobRunStore.set(`${input.jobName}:${input.windowKey}`, input);
    });

    const dependencies = {
      querySummaryLeaderboard: vi.fn().mockResolvedValue([
        {
          slackUserId: "U_1",
          displayName: "Alex Raider",
          totalPoints: 12,
          uniqueRaidsEngaged: 2,
          earlyWindowActions: 1,
          totalActions: 2,
          earlyWindowActionRate: 0.5,
        },
      ]),
      querySummaryTotals: vi.fn().mockResolvedValue({
        totalPoints: 12,
        uniqueRaidsEngaged: 2,
        earlyWindowActions: 1,
        totalActions: 2,
        earlyWindowActionRate: 0.5,
      }),
      replaceMonthlySnapshots,
      upsertJobRun,
    };

    await runMonthClose(
      {
        targetMonthKey: "2026-04",
      },
      dependencies,
    );
    await runMonthClose(
      {
        targetMonthKey: "2026-04",
      },
      dependencies,
    );

    expect(snapshotStore.size).toBe(1);
    expect(jobRunStore.size).toBe(1);
    expect(replaceMonthlySnapshots).toHaveBeenCalledTimes(2);
    expect(upsertJobRun).toHaveBeenCalledTimes(2);
  });
});
