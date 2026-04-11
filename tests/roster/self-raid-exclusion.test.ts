import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("resolvePostOwner", () => {
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

  it("returns a confident match when exactly one active alias resolves", async () => {
    const { resolvePostOwner } = await import("../../src/domain/roster/resolve-post-owner.js");

    const resolved = await resolvePostOwner(
      {
        ownerExternalId: "impact3-owner",
      },
      {
        findActiveTeamMembersByOwnerAlias: vi.fn().mockResolvedValue([
          {
            slackUserId: "U_OWNER",
            displayName: "Owner Person",
          },
        ]),
      },
    );

    expect(resolved).toEqual({
      slackUserId: "U_OWNER",
      displayName: "Owner Person",
    });
  });

  it("returns null for ambiguous alias matches", async () => {
    const { resolvePostOwner } = await import("../../src/domain/roster/resolve-post-owner.js");

    const resolved = await resolvePostOwner(
      {
        ownerDisplayName: "Owner Person",
      },
      {
        findActiveTeamMembersByOwnerAlias: vi.fn().mockResolvedValue([
          {
            slackUserId: "U_ONE",
            displayName: "Owner One",
          },
          {
            slackUserId: "U_TWO",
            displayName: "Owner Two",
          },
        ]),
      },
    );

    expect(resolved).toBeNull();
  });
});

describe("claimEngagement self-raid exclusion", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
      RAIDER_EXCLUDE_SELF_RAIDS: "true",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("persists a confident owner match and suppresses self-scoring when the toggle is enabled", async () => {
    const { claimEngagement } = await import("../../src/domain/scoring/claim-engagement.js");
    const claimEngagementLog = vi.fn();
    const updateRaidOwnerSlackUser = vi.fn();

    await claimEngagement(
      {
        raid: {
          id: "raid-1",
          publishedAt: new Date("2026-04-11T15:45:00.000Z"),
          slackPostedAt: new Date("2026-04-11T15:46:00.000Z"),
          ownerExternalId: "owner-123",
          ownerDisplayName: "Owner Person",
          ownerSlackUserId: null,
        },
        slackUserId: "U_OWNER",
        slackReaction: "heart",
        actionType: "like",
        eventTime: new Date("2026-04-11T15:47:00.000Z"),
      },
      {
        claimEngagementLog,
        resolvePostOwner: vi.fn().mockResolvedValue({
          slackUserId: "U_OWNER",
          displayName: "Owner Person",
        }),
        updateRaidOwnerSlackUser,
      },
    );

    expect(updateRaidOwnerSlackUser).toHaveBeenCalledWith({
      raidPostId: "raid-1",
      ownerSlackUserId: "U_OWNER",
    });
    expect(claimEngagementLog).not.toHaveBeenCalled();
  });

  it("keeps scoring when owner resolution is ambiguous", async () => {
    const { claimEngagement } = await import("../../src/domain/scoring/claim-engagement.js");
    const claimEngagementLog = vi.fn();
    const updateRaidOwnerSlackUser = vi.fn();

    await claimEngagement(
      {
        raid: {
          id: "raid-2",
          publishedAt: new Date("2026-04-11T15:45:00.000Z"),
          slackPostedAt: new Date("2026-04-11T15:46:00.000Z"),
          ownerExternalId: "owner-ambiguous",
          ownerDisplayName: "Owner Person",
          ownerSlackUserId: null,
        },
        slackUserId: "U_MEMBER",
        slackReaction: "heart",
        actionType: "like",
        eventTime: new Date("2026-04-11T15:47:00.000Z"),
      },
      {
        claimEngagementLog,
        resolvePostOwner: vi.fn().mockResolvedValue(null),
        updateRaidOwnerSlackUser,
      },
    );

    expect(updateRaidOwnerSlackUser).not.toHaveBeenCalled();
    expect(claimEngagementLog).toHaveBeenCalledOnce();
  });

  it("keeps scoring when the toggle is disabled even if the owner matches", async () => {
    process.env.RAIDER_EXCLUDE_SELF_RAIDS = "false";

    const { claimEngagement } = await import("../../src/domain/scoring/claim-engagement.js");
    const claimEngagementLog = vi.fn();

    await claimEngagement(
      {
        raid: {
          id: "raid-3",
          publishedAt: new Date("2026-04-11T15:45:00.000Z"),
          slackPostedAt: new Date("2026-04-11T15:46:00.000Z"),
          ownerExternalId: "owner-123",
          ownerDisplayName: "Owner Person",
          ownerSlackUserId: "U_OWNER",
        },
        slackUserId: "U_OWNER",
        slackReaction: "heart",
        actionType: "like",
        eventTime: new Date("2026-04-11T15:47:00.000Z"),
      },
      {
        claimEngagementLog,
        resolvePostOwner: vi.fn(),
        updateRaidOwnerSlackUser: vi.fn(),
      },
    );

    expect(claimEngagementLog).toHaveBeenCalledOnce();
  });
});
