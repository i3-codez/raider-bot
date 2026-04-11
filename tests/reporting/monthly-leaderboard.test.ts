import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("monthly reporting queries", () => {
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

  it("filters removed rows in the leaderboard query and maps roster display names", async () => {
    const { queryMonthlyLeaderboard } = await import(
      "../../src/db/queries/monthly-reporting.js"
    );
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

    const result = await queryMonthlyLeaderboard(
      {
        monthKey: "2026-04",
      },
      executor as any,
    );

    const statement = executor.mock.calls[0]?.[0]?.join("__value__") ?? "";

    expect(statement).toContain("el.removed_at is null");
    expect(result).toEqual([
      {
        slackUserId: "U_1",
        displayName: "Alex Raider",
        totalPoints: 24,
        uniqueRaidsEngaged: 3,
        earlyWindowActions: 2,
        totalActions: 4,
      },
    ]);
  });

  it("filters removed rows in the member stats query", async () => {
    const { queryMemberMonthlyStats } = await import(
      "../../src/db/queries/monthly-reporting.js"
    );
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

    const result = await queryMemberMonthlyStats(
      {
        slackUserId: "U_1",
        monthKey: "2026-04",
      },
      executor as any,
    );

    const statement = executor.mock.calls[0]?.[0]?.join("__value__") ?? "";

    expect(statement).toContain("el.removed_at is null");
    expect(result).toMatchObject({
      displayName: "Alex Raider",
      totalPoints: 24,
    });
  });
});

describe("monthly reporting services", () => {
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

  it("derives the current month key and reuses the query dependencies", async () => {
    const { getMonthlyLeaderboard, getMemberMonthlyStats } = await import(
      "../../src/domain/reporting/monthly-reporting.js"
    );
    const queryMonthlyLeaderboard = vi.fn().mockResolvedValue([]);
    const queryMemberMonthlyStats = vi.fn().mockResolvedValue(null);

    await getMonthlyLeaderboard(
      {
        now: new Date("2026-04-11T12:00:00.000Z"),
      },
      { queryMonthlyLeaderboard },
    );

    await getMemberMonthlyStats(
      {
        slackUserId: "U_1",
        now: new Date("2026-04-11T12:00:00.000Z"),
      },
      { queryMemberMonthlyStats },
    );

    expect(queryMonthlyLeaderboard).toHaveBeenCalledWith({
      monthKey: "2026-04",
      limit: undefined,
    });
    expect(queryMemberMonthlyStats).toHaveBeenCalledWith({
      slackUserId: "U_1",
      monthKey: "2026-04",
    });
  });
});
