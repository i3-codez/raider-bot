import { describe, expect, it } from "vitest";

import { buildRaidMessage } from "../../src/slack/blocks/build-raid-message.js";

describe("buildRaidMessage", () => {
  it("renders the exact low-confidence warning for approximate timing", () => {
    const message = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "low",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });

    const timingBlock = message.blocks[2];

    expect(timingBlock).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":warning: Published time not provided. Using Slack post time, so timing-based scores are approximate.",
      },
    });
  });

  it("renders the exact footer note about score dedupe and undo", () => {
    const message = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "high",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });

    expect(message.blocks[6]).toMatchObject({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "One score per person per action type. Remove your reaction to undo that action.",
        },
      ],
    });
  });

  it("renders the canonical header, URL row, legend, and timing windows from shared config", () => {
    const message = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "high",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });

    expect(message.text).toContain("Raid live: Impact3 on X");
    expect(message.text).toContain("https://x.com/impact3/status/123");
    expect(message.blocks).toHaveLength(7);
    expect(message.blocks[0]).toMatchObject({
      type: "header",
      text: { type: "plain_text", text: "Raid live: Impact3 on X" },
    });
    expect(message.blocks[1]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "<https://x.com/impact3/status/123>\n*Client:* Impact3\n*Platform:* X",
      },
    });
    expect(message.blocks[4]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*How to participate*",
          ":heart: Like",
          ":speech_balloon: Comment",
          ":repeat: Repost",
          ":memo: Quote post",
        ].join("\n"),
      },
    });
    expect(message.blocks[5]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Speed windows*",
          "0-10m: 10 points",
          "10-20m: 8 points",
          "20-30m: 6 points",
          "30-60m: 3 points",
          "60m+: 0 points",
        ].join("\n"),
      },
    });
  });
});
