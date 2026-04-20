import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

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
    APIFY_X_MONITOR_ACTOR_ID: "danek~twitter-scraper-ppr",
  };
  vi.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe("runPilotCheck", () => {
  it("runs the Phase 3 dry-run commands in sequence", async () => {
    const { runPilotCheck } = await import("../../src/scripts/run-pilot-check.js");
    const runSummaryJobCommand = vi.fn().mockResolvedValue(undefined);
    const runMonthCloseCommand = vi.fn().mockResolvedValue(undefined);
    const runOpsSurfacingCommand = vi.fn().mockResolvedValue(undefined);
    const runXMonitorCommand = vi.fn().mockResolvedValue(0);
    const stdout = {
      log: vi.fn(),
    };

    await runPilotCheck({
      runSummaryJobCommand,
      runMonthCloseCommand,
      runOpsSurfacingCommand,
      runXMonitorCommand,
      stdout,
    });

    expect(runSummaryJobCommand).toHaveBeenNthCalledWith(
      1,
      ["--cadence=daily", "--dry-run"],
      { stdout },
    );
    expect(runSummaryJobCommand).toHaveBeenNthCalledWith(
      2,
      ["--cadence=weekly", "--dry-run"],
      { stdout },
    );
    expect(runSummaryJobCommand).toHaveBeenNthCalledWith(
      3,
      ["--cadence=monthly", "--dry-run"],
      { stdout },
    );
    expect(runMonthCloseCommand).toHaveBeenCalledWith(["--dry-run"], { stdout });
    expect(runOpsSurfacingCommand).toHaveBeenCalledWith(["--dry-run"], { stdout });
    expect(runXMonitorCommand).toHaveBeenCalledWith(["--dry-run"], { stdout });
    expect(stdout.log).toHaveBeenCalledWith(
      "Pilot check passed: summary, month-close, ops, and x-monitor dry-run flows all completed.",
    );
  });

  it("fails fast when a required command hook is unavailable", async () => {
    const { runPilotCheck } = await import("../../src/scripts/run-pilot-check.js");

    await expect(
      runPilotCheck({
        runSummaryJobCommand: 0 as any,
        runMonthCloseCommand: vi.fn().mockResolvedValue(undefined),
        runOpsSurfacingCommand: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow("runSummaryJobCommand");
  });
});
