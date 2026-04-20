import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("summary reporting queries", () => {
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

  it("filters by raid publish window and excludes removed engagements", async () => {
    const { querySummaryLeaderboard } = await import("../../src/db/queries/summary-reporting.js");
    const executor = vi.fn().mockResolvedValue([
      {
        slack_user_id: "U_1",
        display_name: "Alex Raider",
        total_points: 24,
        unique_raids_engaged: 3,
        early_window_actions: 2,
        total_actions: 4,
      },
    ]);

    const result = await querySummaryLeaderboard(
      {
        windowStart: new Date("2026-04-10T04:00:00.000Z"),
        windowEnd: new Date("2026-04-11T04:00:00.000Z"),
      },
      executor as any,
    );

    const statement = executor.mock.calls[0]?.[0]?.join("__value__") ?? "";

    expect(statement).toContain("coalesce(rp.published_at, rp.slack_posted_at) >=");
    expect(statement).toContain("el.removed_at is null");
    expect(result[0]).toMatchObject({
      displayName: "Alex Raider",
      earlyWindowActionRate: 0.5,
    });
  });

  it("maps zero-action totals to a zero rate", async () => {
    const { querySummaryTotals } = await import("../../src/db/queries/summary-reporting.js");
    const executor = vi.fn().mockResolvedValue([
      {
        total_points: 0,
        unique_raids_engaged: 0,
        early_window_actions: 0,
        total_actions: 0,
      },
    ]);

    const result = await querySummaryTotals(
      {
        windowStart: new Date("2026-04-10T04:00:00.000Z"),
        windowEnd: new Date("2026-04-11T04:00:00.000Z"),
      },
      executor as any,
    );

    expect(result.earlyWindowActionRate).toBe(0);
  });
});

describe("summary reporting services", () => {
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

  it("derives the previous ET day for daily summaries", async () => {
    const { getSummaryReport } = await import("../../src/domain/reporting/summary-reporting.js");
    const querySummaryLeaderboard = vi.fn().mockResolvedValue([]);
    const querySummaryTotals = vi.fn().mockResolvedValue({
      totalPoints: 0,
      uniqueRaidsEngaged: 0,
      earlyWindowActions: 0,
      totalActions: 0,
      earlyWindowActionRate: 0,
    });

    const report = await getSummaryReport(
      {
        cadence: "daily",
        now: new Date("2026-04-11T12:00:00.000Z"),
      },
      {
        querySummaryLeaderboard,
        querySummaryTotals,
      },
    );

    expect(report.window.label).toContain("Daily Summary");
    expect(querySummaryLeaderboard).toHaveBeenCalledWith({
      windowStart: new Date("2026-04-10T04:00:00.000Z"),
      windowEnd: new Date("2026-04-11T04:00:00.000Z"),
      limit: undefined,
    });
  });

  it("derives the previous ET week from Monday through Sunday", async () => {
    const { getSummaryReport } = await import("../../src/domain/reporting/summary-reporting.js");
    const querySummaryLeaderboard = vi.fn().mockResolvedValue([]);
    const querySummaryTotals = vi.fn().mockResolvedValue({
      totalPoints: 0,
      uniqueRaidsEngaged: 0,
      earlyWindowActions: 0,
      totalActions: 0,
      earlyWindowActionRate: 0,
    });

    const report = await getSummaryReport(
      {
        cadence: "weekly",
        now: new Date("2026-04-15T16:00:00.000Z"),
      },
      {
        querySummaryLeaderboard,
        querySummaryTotals,
      },
    );

    expect(report.window.label).toContain("Weekly Summary");
    expect(querySummaryLeaderboard).toHaveBeenCalledWith({
      windowStart: new Date("2026-04-06T04:00:00.000Z"),
      windowEnd: new Date("2026-04-13T04:00:00.000Z"),
      limit: undefined,
    });
  });

  it("derives the previous ET month for monthly summaries", async () => {
    const { getSummaryReport } = await import("../../src/domain/reporting/summary-reporting.js");
    const querySummaryLeaderboard = vi.fn().mockResolvedValue([]);
    const querySummaryTotals = vi.fn().mockResolvedValue({
      totalPoints: 0,
      uniqueRaidsEngaged: 0,
      earlyWindowActions: 0,
      totalActions: 0,
      earlyWindowActionRate: 0,
    });

    const report = await getSummaryReport(
      {
        cadence: "monthly",
        now: new Date("2026-05-11T16:00:00.000Z"),
      },
      {
        querySummaryLeaderboard,
        querySummaryTotals,
      },
    );

    expect(report.window.label).toContain("Apr 2026");
    expect(querySummaryLeaderboard).toHaveBeenCalledWith({
      windowStart: new Date("2026-04-01T04:00:00.000Z"),
      windowEnd: new Date("2026-05-01T04:00:00.000Z"),
      limit: undefined,
    });
  });
});
