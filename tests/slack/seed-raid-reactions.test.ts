import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("seedRaidReactions", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
    };
    vi.resetModules();
  });

  it("adds one reaction per emoji in the action registry", async () => {
    const { ACTION_REGISTRY } = await import("../../src/domain/scoring/action-registry.js");
    const { seedRaidReactions } = await import("../../src/slack/lib/seed-raid-reactions.js");

    const add = vi.fn().mockResolvedValue(undefined);

    await seedRaidReactions({ reactions: { add } }, "C_RAIDS", "1712865600.000100");

    expect(add).toHaveBeenCalledTimes(ACTION_REGISTRY.length);
    for (const action of ACTION_REGISTRY) {
      expect(add).toHaveBeenCalledWith({
        channel: "C_RAIDS",
        timestamp: "1712865600.000100",
        name: action.emoji,
      });
    }
  });

  it("swallows per-emoji failures so one bad reaction doesn't block the others", async () => {
    const { ACTION_REGISTRY } = await import("../../src/domain/scoring/action-registry.js");
    const { seedRaidReactions } = await import("../../src/slack/lib/seed-raid-reactions.js");

    const add = vi.fn(async ({ name }: { name: string }) => {
      if (name === "repeat") {
        throw new Error("already_reacted");
      }
    });

    await expect(
      seedRaidReactions({ reactions: { add } }, "C_RAIDS", "1712865600.000100"),
    ).resolves.toBeUndefined();

    expect(add).toHaveBeenCalledTimes(ACTION_REGISTRY.length);
  });
});
