import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("registerCommands", () => {
  it("registers the staff command handlers in addition to the existing raid flow", async () => {
    const registerRaidCommand = vi.fn();
    const registerRaidSubmit = vi.fn();
    const registerLeaderboardCommand = vi.fn();
    const registerMystatsCommand = vi.fn();
    const registerRaiderhelpCommand = vi.fn();

    vi.doMock("../../src/slack/commands/register-raid-command.js", () => ({
      registerRaidCommand,
    }));
    vi.doMock("../../src/slack/commands/handle-raid-submit.js", () => ({
      registerRaidSubmit,
    }));
    vi.doMock("../../src/slack/commands/register-leaderboard-command.js", () => ({
      registerLeaderboardCommand,
    }));
    vi.doMock("../../src/slack/commands/register-mystats-command.js", () => ({
      registerMystatsCommand,
    }));
    vi.doMock("../../src/slack/commands/register-raiderhelp-command.js", () => ({
      registerRaiderhelpCommand,
    }));

    const { registerCommands } = await import("../../src/slack/register-commands.js");
    const app = {} as any;

    registerCommands(app);

    expect(registerRaidCommand).toHaveBeenCalledWith(app);
    expect(registerRaidSubmit).toHaveBeenCalledWith(app);
    expect(registerLeaderboardCommand).toHaveBeenCalledWith(app);
    expect(registerMystatsCommand).toHaveBeenCalledWith(app);
    expect(registerRaiderhelpCommand).toHaveBeenCalledWith(app);
  });
});

describe("staff command handlers", () => {
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
    vi.doUnmock("../../src/slack/commands/register-leaderboard-command.js");
    vi.doUnmock("../../src/slack/commands/register-mystats-command.js");
    vi.doUnmock("../../src/slack/commands/register-raiderhelp-command.js");
  });

  function makeClient() {
    return {
      users: {
        info: vi.fn(),
      },
    };
  }

  it("/leaderboard responds in-channel with resolved display names (no mentions)", async () => {
    const { handleLeaderboardCommand } = await import(
      "../../src/slack/commands/register-leaderboard-command.js"
    );
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const client = makeClient();

    await handleLeaderboardCommand(
      {
        ack,
        respond,
        client,
      },
      {
        queryMonthlyLeaderboard: vi.fn().mockResolvedValue([
          {
            slackUserId: "U_1",
            displayName: "Alex Raider",
            totalPoints: 24,
            uniqueRaidsEngaged: 3,
            earlyWindowActions: 2,
            totalActions: 4,
          },
        ]),
        resolveUserNames: vi.fn().mockResolvedValue(new Map([["U_1", "Alex Raider"]])),
      },
    );

    expect(ack).toHaveBeenCalledOnce();
    const payload = respond.mock.calls[0]![0] as { response_type: string; text: string };
    expect(payload.response_type).toBe("in_channel");
    expect(payload.text).toContain("1. Alex Raider - 24 pts");
    expect(payload.text).not.toContain("<@");
  });

  it("/mystats responds ephemerally with the caller's resolved name", async () => {
    const { handleMystatsCommand } = await import(
      "../../src/slack/commands/register-mystats-command.js"
    );
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const client = makeClient();

    await handleMystatsCommand(
      {
        ack,
        command: {
          user_id: "U_1",
        },
        respond,
        client,
      },
      {
        queryMemberMonthlyStats: vi.fn().mockResolvedValue({
          slackUserId: "U_1",
          displayName: "Alex Raider",
          totalPoints: 24,
          uniqueRaidsEngaged: 3,
          earlyWindowActions: 2,
          totalActions: 4,
        }),
        resolveUserNames: vi.fn().mockResolvedValue(new Map([["U_1", "Alex Raider"]])),
      },
    );

    expect(ack).toHaveBeenCalledOnce();
    const payload = respond.mock.calls[0]![0] as { response_type: string; text: string };
    expect(payload.response_type).toBe("ephemeral");
    expect(payload.text).toContain("Alex Raider this month");
    expect(payload.text).not.toContain("<@");
  });

  it("/mystats responds ephemerally when the caller has no tracked activity", async () => {
    const { handleMystatsCommand } = await import(
      "../../src/slack/commands/register-mystats-command.js"
    );
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const client = makeClient();

    await handleMystatsCommand(
      {
        ack,
        command: {
          user_id: "U_2",
        },
        respond,
        client,
      },
      {
        queryMemberMonthlyStats: vi.fn().mockResolvedValue(null),
        resolveUserNames: vi.fn().mockResolvedValue(new Map([["U_2", "Jordan Ops"]])),
      },
    );

    expect(respond).toHaveBeenCalledWith({
      response_type: "ephemeral",
      text: expect.stringContaining("No tracked activity yet this month for Jordan Ops"),
    });
  });

  it("/raiderhelp stays private and uses canonical scoring content", async () => {
    const { handleRaiderhelpCommand } = await import(
      "../../src/slack/commands/register-raiderhelp-command.js"
    );
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handleRaiderhelpCommand({
      ack,
      respond,
    });

    expect(respond).toHaveBeenCalledWith({
      response_type: "ephemeral",
      text: expect.stringContaining(":heart: = Like"),
    });
    expect(respond).toHaveBeenCalledWith({
      response_type: "ephemeral",
      text: expect.stringContaining("0-10m: 10 pts"),
    });
  });
});
