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
  };
  vi.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe("buildOpsSurfacingDigest", () => {
  it("surfaces low-confidence raids even when participation is otherwise healthy", async () => {
    const { buildOpsSurfacingDigest } = await import(
      "../../src/domain/reminders/ops-surfacing.js"
    );

    const result = await buildOpsSurfacingDigest(
      {
        now: new Date("2026-04-11T12:30:00.000Z"),
      },
      {
        queryReminderCandidates: vi.fn().mockResolvedValue([
          {
            raidPostId: "raid-1",
            clientName: "Acme",
            platform: "x",
            postUrl: "https://x.com/acme/status/1",
            publishedAt: null,
            slackPostedAt: new Date("2026-04-11T12:00:00.000Z"),
            timingConfidence: "low",
            earlyWindowActions: 5,
          },
        ]),
        hasOpsAlertPublication: vi.fn().mockResolvedValue(false),
      },
    );

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.alertType).toBe("low_confidence");
  });

  it("surfaces low participation only at or after 20 minutes and below three early actions", async () => {
    const { buildOpsSurfacingDigest } = await import(
      "../../src/domain/reminders/ops-surfacing.js"
    );

    const result = await buildOpsSurfacingDigest(
      {
        now: new Date("2026-04-11T12:20:00.000Z"),
      },
      {
        queryReminderCandidates: vi.fn().mockResolvedValue([
          {
            raidPostId: "raid-2",
            clientName: "Beta",
            platform: "x",
            postUrl: "https://x.com/beta/status/2",
            publishedAt: new Date("2026-04-11T12:00:00.000Z"),
            slackPostedAt: new Date("2026-04-11T12:00:00.000Z"),
            timingConfidence: "high",
            earlyWindowActions: 2,
          },
          {
            raidPostId: "raid-3",
            clientName: "Gamma",
            platform: "x",
            postUrl: "https://x.com/gamma/status/3",
            publishedAt: new Date("2026-04-11T12:01:00.000Z"),
            slackPostedAt: new Date("2026-04-11T12:01:00.000Z"),
            timingConfidence: "high",
            earlyWindowActions: 3,
          },
        ]),
        hasOpsAlertPublication: vi.fn().mockResolvedValue(false),
      },
    );

    expect(result.alerts.map((alert) => alert.raidPostId)).toEqual(["raid-2"]);
    expect(result.alerts[0]?.alertType).toBe("low_participation");
  });
});

describe("publishOpsSurfacing", () => {
  it("records one publication per raid and alert type after posting", async () => {
    const { publishOpsSurfacing } = await import("../../src/jobs/publish-ops-surfacing.js");
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const recordOpsAlertPublication = vi.fn().mockResolvedValue(undefined);

    const result = await publishOpsSurfacing(
      {
        dryRun: false,
        now: new Date("2026-04-11T12:30:00.000Z"),
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        buildOpsSurfacingDigest: undefined as never,
        queryReminderCandidates: vi.fn().mockResolvedValue([
          {
            raidPostId: "raid-4",
            clientName: "Delta",
            platform: "x",
            postUrl: "https://x.com/delta/status/4",
            publishedAt: new Date("2026-04-11T12:00:00.000Z"),
            slackPostedAt: new Date("2026-04-11T12:00:00.000Z"),
            timingConfidence: "high",
            earlyWindowActions: 1,
          },
        ]),
        hasOpsAlertPublication: vi.fn().mockResolvedValue(false),
        recordOpsAlertPublication,
      } as any,
    );

    expect(postMessage).toHaveBeenCalledOnce();
    expect(recordOpsAlertPublication).toHaveBeenCalledWith({
      raidPostId: "raid-4",
      alertType: "low_participation",
      alertWindowKey: "2026-04",
    });
    expect(result.digest.alerts).toHaveLength(1);
  });

  it("does not repost or record in dry-run mode", async () => {
    const { publishOpsSurfacing } = await import("../../src/jobs/publish-ops-surfacing.js");
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const recordOpsAlertPublication = vi.fn().mockResolvedValue(undefined);

    const result = await publishOpsSurfacing(
      {
        dryRun: true,
        now: new Date("2026-04-11T12:30:00.000Z"),
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        queryReminderCandidates: vi.fn().mockResolvedValue([]),
        hasOpsAlertPublication: vi.fn().mockResolvedValue(false),
        recordOpsAlertPublication,
      } as any,
    );

    expect(result.dryRun).toBe(true);
    expect(postMessage).not.toHaveBeenCalled();
    expect(recordOpsAlertPublication).not.toHaveBeenCalled();
  });
});
