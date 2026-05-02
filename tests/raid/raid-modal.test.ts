import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RAID_MODAL_CALLBACK_ID,
  RAID_MODAL_FIELD_IDS,
  buildRaidModal,
} from "../../src/slack/commands/build-raid-modal.js";
import { parseManualRaidInput } from "../../src/domain/raids/manual-raid-input.js";

function buildViewState(input?: {
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

describe("buildRaidModal", () => {
  it("returns the exact phase 1 modal contract and field order", () => {
    const modal = buildRaidModal();

    expect(modal.type).toBe("modal");
    expect(modal.callback_id).toBe(RAID_MODAL_CALLBACK_ID);
    expect(modal.title).toEqual({ type: "plain_text", text: "Create raid" });
    expect(modal.submit).toEqual({ type: "plain_text", text: "Create raid" });
    expect(modal.close).toEqual({ type: "plain_text", text: "Close without posting" });

    expect(modal.blocks[0]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Post a raid target for the team. Published time is optional.",
      },
    });
    expect(modal.blocks.slice(1)).toHaveLength(4);
    expect(modal.blocks.slice(1)).toMatchObject([
      {
        type: "input",
        label: { text: "Post URL" },
        element: { type: "url_text_input", focus_on_load: true },
      },
      {
        type: "input",
        label: { text: "Client name" },
        element: { type: "plain_text_input" },
      },
      {
        type: "input",
        label: { text: "Platform" },
        element: {
          type: "static_select",
          options: [
            { text: { text: "X" }, value: "x" },
            { text: { text: "LinkedIn" }, value: "linkedin" },
          ],
        },
      },
      {
        type: "input",
        label: { text: "Published at (optional)" },
        optional: true,
        element: { type: "datetimepicker" },
        hint: {
          text: "Leave blank if unknown. Raider Bot will use Slack post time and mark the raid as approximate.",
        },
      },
    ]);
  });
});

describe("parseManualRaidInput", () => {
  it("accepts valid input, trims whitespace, forces x, and allows a missing publish time", () => {
    const result = parseManualRaidInput(
      buildViewState({
        postUrl: "  https://twitter.com/impact3/status/1234567890  ",
        clientName: "  Impact3  ",
        publishedAt: null,
      }),
      {
        now: new Date("2026-04-10T16:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        postUrl: "https://twitter.com/impact3/status/1234567890",
        clientName: "Impact3",
        platform: "x",
        publishedAt: null,
      },
    });
  });

  it("rejects invalid URLs, future timestamps, and client names outside the supported range", () => {
    const now = new Date("2026-04-10T16:00:00.000Z");

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "http://x.com/impact3/status/1234567890",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid X post URL.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "https://linkedin.com/posts/impact3-123",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid X post URL.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          clientName: "A",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.clientName.blockId]: "Client name must be 2-60 characters.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          clientName: "A".repeat(61),
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.clientName.blockId]: "Client name must be 2-60 characters.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          publishedAt: Date.parse("2026-04-10T16:01:00.000Z") / 1000,
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.publishedAt.blockId]: "Published time can't be in the future.",
      },
    });
  });

  it("accepts the four supported LinkedIn URL forms when platform=linkedin", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    for (const postUrl of [
      "https://www.linkedin.com/in/williamhgates/recent-activity/all",
      "https://linkedin.com/company/microsoft/posts",
      "https://www.linkedin.com/posts/williamhgates_some-shareable-text-7329207003942125568",
      "https://www.linkedin.com/feed/update/urn:li:activity:7329207003942125568",
    ]) {
      const result = parseManualRaidInput(
        buildViewState({ postUrl, platformValue: "linkedin" }),
        { now },
      );

      expect(result).toEqual({
        ok: true,
        data: {
          postUrl,
          clientName: "Impact3",
          platform: "linkedin",
          publishedAt: null,
        },
      });
    }
  });

  it("rejects non-LinkedIn URLs when platform=linkedin", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "https://x.com/impact3/status/1234567890",
          platformValue: "linkedin",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid LinkedIn post URL.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "https://www.linkedin.com/jobs/view/123",
          platformValue: "linkedin",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid LinkedIn post URL.",
      },
    });
  });

  it("rejects an unknown platform value", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    const result = parseManualRaidInput(
      buildViewState({ platformValue: "facebook" }),
      { now },
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.platform.blockId]: "Platform must be X or LinkedIn.",
      },
    });
  });
});

describe("registerRaidCommand", () => {
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
      APIFY_TOKEN: "test-apify-token",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("opens the modal for allowlisted operators", async () => {
    const { registerRaidCommand } = await import("../../src/slack/commands/register-raid-command.js");
    const registeredHandlers: Record<string, (...args: any[]) => Promise<void>> = {};
    const app = {
      command: vi.fn((commandName: string, handler: (...args: any[]) => Promise<void>) => {
        registeredHandlers[commandName] = handler;
      }),
    };

    registerRaidCommand(app as any);

    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const viewsOpen = vi.fn().mockResolvedValue(undefined);

    await registeredHandlers["/raid"]({
      ack,
      respond,
      client: {
        views: {
          open: viewsOpen,
        },
      },
      command: {
        trigger_id: "1337.42.abcd",
        user_id: "U_OPERATOR",
        channel_id: "C_REQUEST",
      },
    });

    expect(ack).toHaveBeenCalledOnce();
    expect(respond).not.toHaveBeenCalled();
    expect(viewsOpen).toHaveBeenCalledOnce();
    expect(viewsOpen.mock.calls[0]?.[0]).toMatchObject({
      trigger_id: "1337.42.abcd",
      view: expect.objectContaining({
        callback_id: "raid_create_modal",
        private_metadata: JSON.stringify({
          channelId: "C_REQUEST",
          userId: "U_OPERATOR",
        }),
      }),
    });
  });

  it("denies users outside SLACK_RAID_OPERATOR_USER_IDS without opening the modal", async () => {
    const { registerRaidCommand } = await import("../../src/slack/commands/register-raid-command.js");
    const registeredHandlers: Record<string, (...args: any[]) => Promise<void>> = {};
    const app = {
      command: vi.fn((commandName: string, handler: (...args: any[]) => Promise<void>) => {
        registeredHandlers[commandName] = handler;
      }),
    };

    registerRaidCommand(app as any);

    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const viewsOpen = vi.fn().mockResolvedValue(undefined);

    await registeredHandlers["/raid"]({
      ack,
      respond,
      client: {
        views: {
          open: viewsOpen,
        },
      },
      command: {
        trigger_id: "1337.42.abcd",
        user_id: "U_NOT_ALLOWED",
        channel_id: "C_REQUEST",
      },
    });

    expect(ack).toHaveBeenCalledOnce();
    expect(viewsOpen).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledWith({
      response_type: "ephemeral",
      text: "Only configured raid operators can use /raid.",
    });
  });
});
