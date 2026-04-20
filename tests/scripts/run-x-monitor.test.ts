import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runXMonitorCommand", () => {
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

  it("parses --dry-run and forwards dryRun=true", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 0,
      raidsProcessed: 0,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });
    const stdout = { log: vi.fn() };

    const exit = await runXMonitorCommand(["--dry-run"], { runXMonitor, stdout });

    expect(runXMonitor).toHaveBeenCalledWith({ dryRun: true }, expect.any(Object));
    expect(exit).toBe(0);
  });

  it("returns exit code 0 on zero failures", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 1,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runXMonitorCommand([], { runXMonitor, stdout: { log: vi.fn() } });

    expect(exit).toBe(0);
  });

  it("returns exit code 1 when any raid failed", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 2,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 1,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runXMonitorCommand([], { runXMonitor, stdout: { log: vi.fn() } });

    expect(exit).toBe(1);
  });
});
