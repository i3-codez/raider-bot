import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createRaid", () => {
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
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("persists owner metadata and normalized dedupe fields for new webhook raids", async () => {
    const { createRaid } = await import("../../src/domain/raids/create-raid.js");
    const publishedAt = new Date("2026-04-11T15:45:00.000Z");
    const slackPostedAt = new Date("2026-04-11T15:46:00.000Z");
    const postMessage = vi.fn().mockResolvedValue({
      channel: "C_RAIDS",
      ts: "1712847960.000100",
    });
    const insertRaidPost = vi.fn().mockResolvedValue({
      id: "raid-1",
      postUrl: "https://x.com/Impact3/status/1234567890?ref=abc",
      normalizedPostUrl: "https://x.com/Impact3/status/1234567890",
      clientName: "Impact3",
      platform: "x",
      sourceEventId: "evt_123",
      publishedAt,
      slackPostedAt,
      slackMessageTs: "1712847960.000100",
      slackChannelId: "C_RAIDS",
      timingConfidence: "high",
      monthKey: "2026-04",
      ownerExternalId: "owner-123",
      ownerDisplayName: "Alex Raider",
      ownerSlackUserId: null,
    });

    const raid = await createRaid(
      {
        postUrl: "https://x.com/Impact3/status/1234567890?ref=abc",
        clientName: "Impact3",
        platform: "x",
        publishedAt,
        createdBySlackUserId: "publish-webhook",
        sourceEventId: "evt_123",
        ownerExternalId: "owner-123",
        ownerDisplayName: "Alex Raider",
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        now: () => slackPostedAt,
        findRaidByDedupeKey: vi.fn().mockResolvedValue(null),
        insertRaidPost,
        withDedupeLock: async (_key, cb) => cb(),
      },
    );

    expect(postMessage).toHaveBeenCalledOnce();
    expect(insertRaidPost).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedPostUrl: "https://x.com/impact3/status/1234567890",
        sourceEventId: "evt_123",
        ownerExternalId: "owner-123",
        ownerDisplayName: "Alex Raider",
        timingConfidence: "high",
      }),
    );
    expect(raid).toMatchObject({
      sourceEventId: "evt_123",
      ownerExternalId: "owner-123",
      ownerDisplayName: "Alex Raider",
    });
  });

  it("upgrades an existing low-confidence manual raid instead of creating a duplicate post", async () => {
    const { createRaid } = await import("../../src/domain/raids/create-raid.js");
    const existingRaid = {
      id: "raid-existing",
      postUrl: "https://x.com/impact3/status/1234567890",
      normalizedPostUrl: "https://x.com/impact3/status/1234567890",
      clientName: "Impact3",
      platform: "x" as const,
      sourceEventId: null,
      publishedAt: null,
      slackPostedAt: new Date("2026-04-11T15:50:00.000Z"),
      slackMessageTs: "1712848200.000100",
      slackChannelId: "C_RAIDS",
      timingConfidence: "low" as const,
      monthKey: "2026-04",
      ownerExternalId: null,
      ownerDisplayName: null,
      ownerSlackUserId: null,
    };
    const correctRaidPublishedAt = vi.fn().mockResolvedValue({
      raid: {
        ...existingRaid,
        publishedAt: new Date("2026-04-11T15:45:00.000Z"),
        timingConfidence: "high",
      },
      engagementUpdates: [],
    });
    const updateMetadata = vi.spyOn(
      await import("../../src/db/queries/insert-raid-post.js"),
      "updateRaidPostWebhookMetadata",
    ).mockResolvedValue({
      ...existingRaid,
      sourceEventId: "evt_456",
      ownerExternalId: "owner-456",
      ownerDisplayName: "Owner Person",
      ownerSlackUserId: null,
    });

    const raid = await createRaid(
      {
        postUrl: existingRaid.postUrl,
        clientName: existingRaid.clientName,
        platform: "x",
        publishedAt: new Date("2026-04-11T15:45:00.000Z"),
        createdBySlackUserId: "publish-webhook",
        sourceEventId: "evt_456",
        ownerExternalId: "owner-456",
        ownerDisplayName: "Owner Person",
      },
      {
        client: {
          chat: {
            postMessage: vi.fn(),
            update: vi.fn(),
          },
        },
        findRaidByDedupeKey: vi.fn().mockResolvedValue(existingRaid),
        correctRaidPublishedAt,
        withDedupeLock: async (_key, cb) => cb(),
      },
    );

    expect(updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        raidPostId: "raid-existing",
        sourceEventId: "evt_456",
        ownerExternalId: "owner-456",
      }),
    );
    expect(correctRaidPublishedAt).toHaveBeenCalledOnce();
    expect(raid).toMatchObject({
      id: "raid-existing",
      sourceEventId: "evt_456",
      ownerExternalId: "owner-456",
      timingConfidence: "high",
    });

    updateMetadata.mockRestore();
  });
});

describe("handlePublishWebhookRequest", () => {
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
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("rejects missing published_at payloads", async () => {
    const { handlePublishWebhookRequest, PUBLISH_WEBHOOK_SECRET_HEADER } = await import(
      "../../src/app/publish-webhook.js"
    );

    const response = await handlePublishWebhookRequest(
      {
        headers: {
          [PUBLISH_WEBHOOK_SECRET_HEADER]: "publish-secret",
        },
        bodyText: JSON.stringify({
          post_url: "https://x.com/impact3/status/1234567890",
          client_name: "Impact3",
          platform: "x",
        }),
      },
      {
        context: {
          client: {
            chat: {
              postMessage: vi.fn(),
            },
          },
        },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: "invalid_payload",
    });
  });

  it("routes valid webhook payloads through createRaid", async () => {
    const { handlePublishWebhookRequest, PUBLISH_WEBHOOK_SECRET_HEADER } = await import(
      "../../src/app/publish-webhook.js"
    );
    const createRaid = vi.fn().mockResolvedValue({
      id: "raid-2",
      timingConfidence: "high",
    });

    const response = await handlePublishWebhookRequest(
      {
        headers: {
          [PUBLISH_WEBHOOK_SECRET_HEADER]: "publish-secret",
        },
        bodyText: JSON.stringify({
          post_url: "https://x.com/impact3/status/1234567890",
          client_name: "Impact3",
          platform: "x",
          published_at: "2026-04-11T15:45:00.000Z",
          source_event_id: "evt_789",
          owner_external_id: "owner-789",
        }),
      },
      {
        createRaid,
        context: {
          client: {
            chat: {
              postMessage: vi.fn(),
            },
          },
        },
      },
    );

    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: "evt_789",
        ownerExternalId: "owner-789",
        createdBySlackUserId: "publish-webhook",
      }),
      expect.any(Object),
    );
    expect(response).toMatchObject({
      status: 200,
      body: {
        ok: true,
        raid_id: "raid-2",
        timing_confidence: "high",
      },
    });
  });
});
