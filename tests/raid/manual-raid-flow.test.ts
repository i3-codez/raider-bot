import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRaidMessage } from "../../src/slack/blocks/build-raid-message.js";
import { RAID_MODAL_CALLBACK_ID, RAID_MODAL_FIELD_IDS } from "../../src/slack/commands/build-raid-modal.js";

function buildSubmissionState(input?: {
  postUrl?: string;
  clientName?: string;
  platformValue?: string;
  publishedAt?: number | null;
}) {
  const postUrl = input?.postUrl ?? "https://x.com/impact3/status/1234567890";
  const clientName = input?.clientName ?? "Impact3";
  const platformValue = input?.platformValue ?? "x";
  const publishedAt = input?.publishedAt ?? null;

  return {
    values: {
      [RAID_MODAL_FIELD_IDS.postUrl.blockId]: {
        [RAID_MODAL_FIELD_IDS.postUrl.actionId]: {
          type: "url_text_input",
          value: postUrl,
        },
      },
      [RAID_MODAL_FIELD_IDS.clientName.blockId]: {
        [RAID_MODAL_FIELD_IDS.clientName.actionId]: {
          type: "plain_text_input",
          value: clientName,
        },
      },
      [RAID_MODAL_FIELD_IDS.platform.blockId]: {
        [RAID_MODAL_FIELD_IDS.platform.actionId]: {
          type: "static_select",
          selected_option: {
            text: {
              type: "plain_text",
              text: "X",
            },
            value: platformValue,
          },
        },
      },
      [RAID_MODAL_FIELD_IDS.publishedAt.blockId]: {
        [RAID_MODAL_FIELD_IDS.publishedAt.actionId]:
          publishedAt === null
            ? {
                type: "datetimepicker",
              }
            : {
                type: "datetimepicker",
                selected_date_time: publishedAt,
              },
      },
    },
  };
}

describe("createManualRaid", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("stores high confidence and derives the month key from publishedAt when provided", async () => {
    const { createManualRaid } = await import("../../src/domain/raids/create-manual-raid.js");
    const publishedAt = new Date("2026-03-31T23:50:00.000Z");
    const slackPostedAt = new Date("2026-04-10T16:00:00.000Z");
    const postMessage = vi.fn().mockResolvedValue({
      channel: "C_RAIDS",
      ts: "1712865600.000100",
    });
    const insertRaidPost = vi.fn().mockResolvedValue({
      id: "raid-1",
      postUrl: "https://x.com/impact3/status/1234567890",
      clientName: "Impact3",
      platform: "x",
      publishedAt,
      slackPostedAt,
      slackMessageTs: "1712865600.000100",
      slackChannelId: "C_RAIDS",
      timingConfidence: "high",
      monthKey: "2026-03",
    });

    const raid = await createManualRaid(
      {
        postUrl: "https://x.com/impact3/status/1234567890",
        clientName: "Impact3",
        platform: "x",
        publishedAt,
        createdBySlackUserId: "U_OPERATOR",
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        now: () => slackPostedAt,
        insertRaidPost,
      },
    );

    expect(postMessage).toHaveBeenCalledOnce();
    expect(insertRaidPost).toHaveBeenCalledWith(
      expect.objectContaining({
        postUrl: "https://x.com/impact3/status/1234567890",
        clientName: "Impact3",
        platform: "x",
        createdBySlackUserId: "U_OPERATOR",
        publishedAt,
        slackPostedAt,
        slackMessageTs: "1712865600.000100",
        slackChannelId: "C_RAIDS",
        timingConfidence: "high",
        monthKey: "2026-03",
      }),
    );
    expect(raid).toMatchObject({
      timingConfidence: "high",
      monthKey: "2026-03",
    });
  });

  it("uses Slack post time for low confidence, posts the canonical message, and persists Slack metadata", async () => {
    const { createManualRaid } = await import("../../src/domain/raids/create-manual-raid.js");
    const slackPostedAt = new Date("2026-04-10T16:00:00.000Z");
    const postMessage = vi.fn().mockResolvedValue({
      channel: "C_RAIDS",
      ts: "1712865600.000200",
    });
    const insertRaidPost = vi.fn().mockResolvedValue({
      id: "raid-2",
      postUrl: "https://x.com/impact3/status/1234567890",
      clientName: "Impact3",
      platform: "x",
      publishedAt: null,
      slackPostedAt,
      slackMessageTs: "1712865600.000200",
      slackChannelId: "C_RAIDS",
      timingConfidence: "low",
      monthKey: "2026-04",
    });

    const raid = await createManualRaid(
      {
        postUrl: "https://x.com/impact3/status/1234567890",
        clientName: "Impact3",
        platform: "x",
        publishedAt: null,
        createdBySlackUserId: "U_OPERATOR",
      },
      {
        client: {
          chat: {
            postMessage,
          },
        },
        now: () => slackPostedAt,
        insertRaidPost,
      },
    );

    expect(postMessage).toHaveBeenCalledWith({
      channel: "C_RAIDS",
      ...buildRaidMessage({
        clientName: "Impact3",
        platform: "x",
        postUrl: "https://x.com/impact3/status/1234567890",
        timingConfidence: "low",
        referenceTime: slackPostedAt,
      }),
    });
    expect(insertRaidPost).toHaveBeenCalledWith(
      expect.objectContaining({
        publishedAt: null,
        slackPostedAt,
        slackMessageTs: "1712865600.000200",
        slackChannelId: "C_RAIDS",
        timingConfidence: "low",
        monthKey: "2026-04",
      }),
    );
    expect(raid).toMatchObject({
      publishedAt: null,
      timingConfidence: "low",
      slackMessageTs: "1712865600.000200",
      slackChannelId: "C_RAIDS",
      monthKey: "2026-04",
    });
  });
});

describe("raid modal submit flow", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("registers the modal submit handler on the canonical callback id", async () => {
    const { registerRaidSubmit } = await import("../../src/slack/commands/handle-raid-submit.js");
    const app = {
      view: vi.fn(),
    };

    registerRaidSubmit(app as any);

    expect(app.view).toHaveBeenCalledWith(RAID_MODAL_CALLBACK_ID, expect.any(Function));
  });

  it("acks valid submissions, creates the raid, and sends an approximate confirmation to the requesting channel", async () => {
    const { handleRaidSubmit } = await import("../../src/slack/commands/handle-raid-submit.js");
    const createManualRaid = vi.fn().mockResolvedValue({
      id: "raid-3",
      postUrl: "https://x.com/impact3/status/1234567890",
      clientName: "Impact3",
      platform: "x",
      publishedAt: null,
      slackPostedAt: new Date("2026-04-10T16:00:00.000Z"),
      slackMessageTs: "1712865600.000300",
      slackChannelId: "C_RAIDS",
      timingConfidence: "low",
      monthKey: "2026-04",
    });
    const ack = vi.fn().mockResolvedValue(undefined);
    const postEphemeral = vi.fn().mockResolvedValue(undefined);

    await handleRaidSubmit(
      {
        ack,
        client: {
          chat: {
            postEphemeral,
          },
        },
        view: {
          private_metadata: JSON.stringify({
            channelId: "C_REQUEST",
            userId: "U_OPERATOR",
          }),
          state: buildSubmissionState({
            publishedAt: null,
          }),
        },
      } as any,
      {
        createManualRaid,
      },
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledWith();
    expect(createManualRaid).toHaveBeenCalledWith(
      {
        postUrl: "https://x.com/impact3/status/1234567890",
        clientName: "Impact3",
        platform: "x",
        publishedAt: null,
        createdBySlackUserId: "U_OPERATOR",
      },
      expect.objectContaining({
        client: expect.objectContaining({
          chat: expect.objectContaining({
            postEphemeral,
          }),
        }),
      }),
    );
    expect(postEphemeral).toHaveBeenCalledWith({
      channel: "C_REQUEST",
      user: "U_OPERATOR",
      text: "Raid posted in <#C_RAIDS>. Timing confidence: approximate.",
    });
  });
});
